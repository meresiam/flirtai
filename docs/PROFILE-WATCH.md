# Profile Watch — manual operacional

Módulo de monitoramento periódico de perfis Instagram públicos. Cobre 3 fontes:

- `competitor` — concorrentes de marca.
- `influencer` — influencers em prospecção/portfólio.
- `self` — auto-análise do próprio perfil (Wave 4, pendente App Review Meta).

## Visão geral

```
Scheduler externo  ──cron──▶  POST /api/cron/profile-scan
                                │
                                ├─ valida X-Cron-Secret
                                ├─ SELECT profiles vencidos (status=active, next_scan_at<=now)
                                └─ runProfileScan(profile)
                                      ├─ Apify ou Graph API (Wave 4)
                                      ├─ insert ProfileSnapshot
                                      ├─ diff posts (novos / vistos / deletados / reaparecidos)
                                      ├─ se janela fechou: Anthropic tool_use → ProfileReport
                                      └─ update lastScanAt + nextScanAt
```

## Setup

1. Adicione as variáveis novas ao `.env`:

```sh
APIFY_API_TOKEN="..."
CRON_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
```

2. Rode a migration:

```sh
npx prisma migrate deploy
```

3. Em dev local, dispare o cron manualmente:

```sh
curl -X POST http://localhost:3000/api/cron/profile-scan \
  -H "X-Cron-Secret: $CRON_SECRET"
```

## Scheduler externo (Coolify)

O cron handler é stateless, então qualquer scheduler que faça POST HTTP funciona.

### Opção A — Coolify Cron (recomendado)

Em Coolify, no projeto do flirtai:

1. **Resources → Add → Scheduled Tasks**.
2. **Command**:
   ```sh
   curl -fsS -X POST https://$COOLIFY_FQDN/api/cron/profile-scan \
     -H "X-Cron-Secret: $CRON_SECRET"
   ```
3. **Frequency**: `*/10 * * * *` (a cada 10 minutos).
4. Variáveis `$COOLIFY_FQDN` e `$CRON_SECRET` já são injetadas pelo Coolify a partir do app.

### Opção B — cron-job.org (fallback gratuito)

1. https://console.cron-job.org → criar job.
2. URL: `https://flirtai.../api/cron/profile-scan`.
3. Method: `POST`.
4. Header: `X-Cron-Secret: <valor>`.
5. Schedule: a cada 10 minutos.

## Operação

### Adicionar perfil (REST)

```sh
curl -X POST http://localhost:3000/api/profiles \
  -H "content-type: application/json" \
  -H "cookie: better-auth.session_token=..." \
  -d '{
    "source": "competitor",
    "handle": "nike",
    "cadenceHours": 24,
    "consentVersion": "2026-05-v1"
  }'
```

Limites:
- 3 perfis ativos por usuário (env `PROFILES_PER_USER_LIMIT`).
- Cadência entre 6h e 168h (`PROFILE_WATCH_CADENCE_MIN/MAX`).
- Perfil privado → erro hard, perfil vai pra `status=error`.

### Scan manual

```sh
curl -X POST http://localhost:3000/api/profiles/{id}/scan \
  -H "cookie: better-auth.session_token=..."
```

Rate limit: 10 por hora por user (custo Apify + Anthropic).

### Pause/resume

```sh
curl -X PATCH http://localhost:3000/api/profiles/{id} \
  -H "content-type: application/json" \
  -d '{ "status": "paused" }'
```

### Deletar

```sh
curl -X DELETE http://localhost:3000/api/profiles/{id}
```

Cascade remove snapshots, posts, reports e suggestions.

## Custo runtime

| Item                    | Custo unitário     | 100 perfis × 30d |
|-------------------------|--------------------|------------------|
| Apify scrape (1 perfil) | ~$0.015            | ~$45             |
| Anthropic report        | ~$0.025            | ~$75             |
| **Total ordem de grandeza** |               | **~$120/mês**    |

## Conformidade

- **LGPD:** base legal = legítimo interesse comercial (competitor/influencer) ou execução de contrato (self).
- **Termo versionado** (`CURRENT_CONSENT_VERSION`) — mudança força re-aceite.
- **Schema sem campos psicográficos.** Tentativa de adicionar (`dating_status`, `partner_handle`, etc.) deve ser rejeitada em PR.
- **Hard-block** em perfil privado.
- **Retenção 180 dias** (env `PROFILE_WATCH_RETENTION_DAYS`). Purge agendado fica como TODO da Wave 5.
- **Sem mass scraping.** Cadência mínima 6h, batch máximo 50 por chamada do cron.

## Arquitetura interna

```
src/lib/profile-watch/
├── types.ts                # contratos compartilhados
├── consent-text.ts         # termos versionados
├── limits.ts               # PROFILE_WATCH_LIMITS
├── apify-client.ts         # Apify Instagram Profile Scraper
├── meta-graph-client.ts    # stub (Wave 4)
├── token-crypto.ts         # AES-GCM pro graphAccessToken (Wave 4)
├── post-differ.ts          # diff entre posts DB ↔ scrape
├── report-builder.ts       # gera ProfileReport via Anthropic tool_use
├── serializers.ts          # DB → JSON, esconde campos sensíveis
├── zod-schemas.ts          # validação payload
├── cron-runner.ts          # orquestrador por perfil
└── tools/
    ├── report-tool-schema.ts
    └── coaching-tool-schema.ts (Wave 4)

src/app/api/profiles/
├── route.ts                # GET (lista) · POST (cria)
├── consent/route.ts        # GET (texto do termo atual)
├── [id]/route.ts           # GET · PATCH · DELETE
├── [id]/scan/route.ts      # POST (scan manual)
├── [id]/reports/route.ts   # GET (timeline)
└── [id]/suggestions/[suggestionId]/route.ts  # PATCH ack

src/app/api/cron/
└── profile-scan/route.ts   # POST cron handler
```

## Próximas waves

- **Wave 2:** UI `/profiles` + `/profiles/new` + ConsentDialog.
- **Wave 3:** UI `/profiles/[id]` + ReportTimeline + PostHistory.
- **Wave 4:** OAuth Meta + Graph API client + Self-Coach (CoachingSuggestion).
- **Wave 5:** Nielsen audit + mobile audit + purge job.
