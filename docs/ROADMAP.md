---
projeto: flirtai
documento: ROADMAP
versao: 1.0
criado: 24-05-2026
owner: Meres
status: ativo
total_waves: 9
total_estimado_dias_uteis: 24-33
---

# FlirtAI — Roadmap de Desenvolvimento

## Visão de produto

> **FlirtAI é o melhor amigo do homem quando se trata de mulher.**
> Wingman pessoal, estrategista de comunicação, coach que ajuda o homem a pegar a mulher que quiser — com respeito, autorrespeito e timing. Não é assistente genérico. Não é ChatGPT temático. É o amigo afiado que entende o jogo.

Cada wave existe pra reforçar essa promessa: estabilizar o core (W0-W5) → conhecer o homem (W6-W7) → mostrar o jogo (W8).

---

## Princípios de ordenação

1. **Foundation antes de feature** — sem testes e sem observability voamos cegos.
2. **Bug fix em LLM antes de UX em LLM** — corrigir parser de status (C1) antes de mexer em streaming (M1).
3. **Schema migrations contíguas** — agrupar pra evitar 2 deploys de migration.
4. **Features novas só depois do core estabilizado** — Memória do Homem entra depois das 5 waves de hardening.
5. **Schema-First + Component-First** — Tier 1+2 obrigam DATA-MODEL.md e COMPONENT-MAP.md antes de codar a feature (CLAUDE.md L2).
6. **MOBILE-FIRST + Nielsen H1-H10** — gates obrigatórios antes de fechar qualquer wave com UI nova.

---

## Resumo das waves

| Wave | Nome | Tipo | Estimativa | Bloqueia |
|---|---|---|---|---|
| **W0** | Foundation (testes + observability + naming) ✅ DONE — 24-05-2026 | hardening | 3-4 dias | tudo |
| **W1** | Coach Reliability (bugs LLM + crypto) | hardening | 2-3 dias | W2, W6 |
| **W2** | Coach UX (streaming + schema cleanup) | UX | 3-4 dias | — |
| **W3** | Multimodal + Comandos (Vision + commands.ts) | UX | 2-3 dias | W6 (vision) |
| **W4** | Profile Watch Hardening (consent + retry) | hardening | 2 dias | — |
| **W5** | Settings & Search expandidos | UX | 1-2 dias | W6 |
| **W6** | **Memória do Homem** (UserProfile) | feature | 4-6 dias | W8 |
| **W7** | **Diário de Campo** (EncounterLog) | feature | 3-4 dias | W8 |
| **W8** | **Painel Status do Jogo** (dashboard) | feature | 4-5 dias | — |

**Total:** ~24-33 dias úteis = **5-7 semanas**.

## Diagrama de dependências

```
W0 ─┬─→ W1 ─→ W2 ─→ W3
    │
    ├─→ W4                  (independente)
    │
    └─→ W5 ─→ W6 ─┬─→ W8
                   │
              W7 ──┘
```

Paralelismo possível depois de W0:
- **Track A:** W1 → W2 → W3 (coach core)
- **Track B:** W4 (profile watch)
- **Track C:** W5 → W6 → W7 (homem + diário) → W8 (dashboard consome)

---

## W0 — Foundation

**Objetivo:** parar de voar cego antes de qualquer feature.

### Escopo

- **C3** — vitest setup + 1 teste de contrato em `coach-schema` (input/output) + 1 smoke E2E (Playwright) do fluxo `login → criar contato → mandar /coach`.
- **C7** — Langfuse self-hosted ou Helicone. Wrappar Anthropic client com tracing. Log estruturado por call: `route, userId hash, model, tokens in/out, latency, mode, cache hit`.
- **C9** — migration cross-cutting: `"hot lead"` → `"hot_lead"` em DB enum, TS types, UI labels, coach-schema enum, serializer. **Naming Lock 100%.**

### Schema-First markers

- Sem mudança de model. Migration `rename_enum_hot_lead`.

### Gate de saída

- `npm test` verde
- Dashboard Langfuse mostrando 1ª call de produção
- `grep -r "hot lead"` retorna zero
- 1 smoke E2E rodando localmente sem flake

### Agentes responsáveis

- `platform-agent` — testes + migration + naming
- `coach-llm-agent` — Langfuse wrap + enum no schema
- `contacts-agent` — serializer
- `desenrolo-shell-agent` — labels UI

---

## W1 — Coach Reliability

**Objetivo:** zerar bugs e desperdício no único ponto LLM.

### Escopo

- **C1** — substituir o `if/else` inline de status em `api/coach/route.ts:140-141` por `statusToDb()` em `serializers.ts`. Teste de regressão garantindo qualquer string LLM vira valor DB válido.
- **C2** — adicionar `User.anthropicApiKeyEncrypted` (nullable), migration data-copy do plaintext + drop coluna velha. Reusar `lib/profile-watch/token-crypto.ts`.
- **C4** — `system: [{ type: "text", text: ..., cache_control: { type: "ephemeral" } }]`. Validar via Langfuse que `cache_read_input_tokens > 0`.
- **C5** — subir `HISTORY_CAP` 8 → 20. Implementar rolling summary: quando `Contact.messages.count > 30`, gerar `Contact.conversationSummary` (campo novo) via call separada Haiku barata, injetar no contexto antes das últimas 20.

### Schema-First markers

- Migration `encrypt_anthropic_api_key` (add col + backfill + drop)
- Migration `add_conversation_summary` (`Contact.conversationSummary String?`)
- Atualizar `docs/DATA-MODEL.md`

### Gate de saída

- Custo médio por call cai ≥40% no Langfuse (prompt cache funcionando)
- Zero erro 502 por status parsing em 100 calls de smoke
- 1 contato com >30 mensagens tem summary populado e injetado

### Agentes responsáveis

- `coach-llm-agent` — fix C1, C4, C5
- `auth-settings-agent` — encrypt key (C2 do lado settings)
- `platform-agent` — migrations + DATA-MODEL.md

---

## W2 — Coach UX

**Objetivo:** sensação de "wingman pensando em voz alta".

### Escopo

- **M1 — Streaming SSE.** Trocar `messages.create` → `messages.stream`. Endpoint vira `text/event-stream`. Cliente consome com `EventSource` (ou fetch+ReadableStream) e renderiza `assistantMessage` incrementalmente. `suggestions` + `insight` + `contact` chegam ao final (tool_use vem em bloco, não tokeniza).
- **M2 — Schema expandido das sugestões:** adicionar `risk: "Safe" | "Risky" | "High-risk"` e `likelyResponse: string` em cada `ReplySuggestion`. UI mostra como pill + tooltip.
- **M3 — Campos optional** em `contact` do tool schema (`personalityType`, `interests`, `tags`). Merge inteligente já existe no route — só remover do `required`.

### Schema-First markers

- Sem mudança de DB.
- Mudança em `coach-schema.ts` (tool definition) + `types/flirt.ts` (TS).
- Atualizar contrato em `docs/DATA-MODEL.md` se documentar tool schema lá.

### Gate de saída

- TTFB visual (primeira palavra no chat) ≤500ms
- Todos os 3 campos opcionais retornam vazio sem quebrar UI em 20 calls de teste
- `risk` e `likelyResponse` aparecem em todas as sugestões

### Agentes responsáveis

- `coach-llm-agent` — streaming + schema
- `desenrolo-shell-agent` — consumir SSE + UI pills

---

## W3 — Multimodal + Comandos

**Objetivo:** print da conversa funciona instantâneo, comandos viram lib reutilizável.

### Escopo

- **C6** — eliminar Tesseract.js. Aceitar imagem no `/api/coach` (multipart ou base64), repassar como `image` block na call Anthropic. Adicionar `Message.attachments Json` (URLs ou refs).
- **M4** — quando print contém foto de perfil dela detectável, extrair via Vision e setar `Contact.avatarUrl` (Cloudflare R2 ou base64 inline pra começar). Skip se contato já tem avatar.
- **M6** — `src/lib/flirt/commands.ts` exporta `COACH_COMMANDS: Command[]`. Cada um: `prefix, label, description, icon, modeOverride?`. Shell consome (substitui array hardcoded em `flirt-ai-shell.tsx:113-138`). Prepara terreno pra expansão futura.

### Schema-First markers

- Migration `add_message_attachments` (`Message.attachments Json?`)
- Possível bucket R2 ou volume Coolify pra arquivos (decidir no início da wave)

### Gate de saída

- Print de WhatsApp processa < 3s end-to-end
- 1 comando de exemplo (`/perfil`) extrai foto e seta avatar
- Bundle do client reduz (remoção do Tesseract.js worker + langs `por`+`eng`)

### Agentes responsáveis

- `coach-llm-agent` — vision block + commands lib
- `desenrolo-shell-agent` — UI upload + avatar
- `platform-agent` — R2/storage (se for o caso) + migration attachments

---

## W4 — Profile Watch Hardening

**Objetivo:** Profile Watch deixa de ser risco regulatório/operacional.

### Escopo

- **C8** — middleware em `api/profiles/*` lê `consent-text.ts::CURRENT_VERSION`. Se `MonitoredProfile.consentVersion !== CURRENT_VERSION` → bloqueia operações de scan + retorna 409 com URL pra reaceitar. UI já tem dialog, só conectar.
- **M7** — `cron-runner.ts` envolve cada scan em try/catch. Erro → `lastErrorMessage` + `nextScanAt = now + (errorCount * 2)h` com cap em 24h. Resetar `errorCount` em sucesso.

### Schema-First markers

- Migration `add_profile_error_count` (`MonitoredProfile.errorCount Int @default(0)`)

### Gate de saída

- Mudança em `CURRENT_VERSION` força re-aceite em ≥1 profile (manual)
- Cron simulando falha agenda retry exponencial corretamente
- Profile com 5 falhas seguidas tem `nextScanAt` = +10h

### Agentes responsáveis

- `profile-watch-agent` — middleware consent + UI conectada
- `cron-retention-agent` — retry exponencial
- `platform-agent` — migration errorCount

---

## W5 — Settings & Search expandidos

**Objetivo:** preparar fundação pra Memória do Homem (W6).

### Escopo

- **M5** — `GET /api/contacts?q=` no servidor com `ilike` em `name/tags/location/metContext`. Avaliar `pg_trgm` extension + index parcial `Contact(userId)`. Cliente debounce 250ms (substitui filtro client-only em `desenrolos/page.tsx:48-59`).
- **M8** — `/settings` ganha seções:
  - **Conta** — timezone, idioma
  - **Coach** — tom default (`low-key | direto | provocador`)
  - **Notificações** — push on/off, frequência
  - **API & Modelo** — já existe

### Schema-First markers

- Migration `add_user_preferences` (`User.timezone, User.locale, User.coachTone, User.notificationPrefs Json`)
- Opcional: `pg_trgm` extension + index `contact_search_idx`

### Gate de saída

- Busca em 500 contatos < 100ms
- Settings novas persistem e impactam system prompt do coach (verificar em Langfuse)

### Agentes responsáveis

- `contacts-agent` — search server-side
- `auth-settings-agent` — settings UI + persist
- `coach-llm-agent` — consumir `coachTone` no system prompt
- `platform-agent` — migrations + extension

---

## W6 — Memória do Homem

**Objetivo:** coach para de dar conselho genérico — sabe quem é o cara.

> Esta é a wave que muda o jogo. Sem ela, o FlirtAI é "chat com prompt bom". Com ela, vira **wingman pessoal**.

### Escopo

#### Schema-First (obrigatório antes de codar)

- Atualizar `docs/DATA-MODEL.md` com:
  ```
  UserProfile {
    @id userId (1-1 com User)
    tone            String?     // override do coach tone p/ esse user
    age             Int?
    locationCity    String?
    contextLife     String?     // "universitário", "corporativo", "autônomo"
    demographics    Json        // estado civil, filhos, etc — opcional
    redPatterns     Json        // string[] — padrões problemáticos detectados
    winSamples      Json        // string[] — frases/abordagens que deram certo
    onboardingDone  Boolean @default(false)
    updatedAt       DateTime @updatedAt
  }
  ```
- Atualizar `docs/COMPONENT-MAP.md` com rotas e componentes da feature.

#### Implementação

- Migration `create_user_profile`.
- Onboarding 6-perguntas (PT-BR, mobile-first) disparado no primeiro login pós-signup → preenche `UserProfile` initial. Skip-able com aviso "coach vai dar conselho genérico até você preencher".
- `lib/flirt/me-context.ts` — função `buildMeContext(userProfile)` retorna bloco string injetado no system prompt **com `cache_control: ephemeral`** (não muda entre turns).
- Feedback loop: novo botão `[Funcionou] / [Não funcionou]` em cada `ReplySuggestion` enviada pelo homem (UI no shell).
  - Positivo → texto entra em `UserProfile.winSamples`
  - Negativo → padrão extraído via classificador Haiku → entra em `UserProfile.redPatterns`
  - Endpoint: `POST /api/me/profile/feedback`
- UI `/me` com:
  - Visualização "o que o coach sabe sobre mim"
  - Edição manual de cada campo
  - Botão "limpar memória" (LGPD)

### Gate de saída

- Onboarding completo em < 2min em mobile
- System prompt do coach inclui bloco "sobre o usuário" verificado em Langfuse (com cache hit)
- 1 ciclo completo de feedback: suggestion → enviou → marcou funcionou → entrou em `winSamples` → próximo turn referencia
- Nielsen H1-H10 PASS

### Agentes responsáveis

- `platform-agent` — schema + migration + DATA-MODEL.md
- `coach-llm-agent` — injeção no system + classificador feedback (Haiku)
- `auth-settings-agent` — onboarding UI + `/me` page
- `contacts-agent` — endpoint de feedback (e ligação com `Message`)
- `desenrolo-shell-agent` — botões `[Funcionou]/[Não funcionou]` no shell

---

## W7 — Diário de Campo

**Objetivo:** captura pós-encontro vira combustível do coach e da Memória do Homem.

### Escopo

#### Schema-First

```
EncounterLog {
  id            String   @id @default(cuid())
  contactId     String   @map("contact_id")
  happenedAt    DateTime @map("happened_at")
  rawText       String   @map("raw_text")
  extracted     Json     // { greenFlags[], redFlags[], escalation, mood, nextMove }
  createdAt     DateTime @default(now()) @map("created_at")

  contact       Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)

  @@index([contactId, happenedAt(sort: Desc)])
  @@map("encounter_log")
}
```

#### Implementação

- Migration `create_encounter_log`.
- UI: botão `[+ Como foi?]` no card do contato em `desenrolos/[id]/page.tsx`.
- Modal de captura — textarea grande, livre. PT-BR.
- `POST /api/contacts/:id/encounters`:
  1. Grava raw
  2. Síncrono no MVP: call Anthropic com tool_use schema `extract_encounter` (definir em `lib/flirt/encounter-schema.ts`)
  3. Atualiza `Contact.greenFlags`, `redFlags`, `lastInteractionSummary`, possivelmente `attractionLevel`
  4. **Se o homem repetiu padrão problemático → alimenta `UserProfile.redPatterns`** (integração com W6)
- Timeline de encontros no `desenrolos/[id]/page.tsx` (cronológico desc).

### Schema-First markers

- Atualizar `docs/DATA-MODEL.md` com `EncounterLog`
- Atualizar `docs/COMPONENT-MAP.md` com modal + timeline

### Gate de saída

- 1 log com 200 caracteres extrai ≥3 sinais corretamente
- Contato atualiza flags
- Timeline aparece no perfil
- Padrão recorrente do homem entra em `redPatterns` (cobre integração com W6)

### Agentes responsáveis

- `contacts-agent` — model + endpoint + serializers
- `coach-llm-agent` — extrator via tool_use schema (`encounter-schema.ts`)
- `desenrolo-shell-agent` — modal + timeline UI
- `platform-agent` — migration

---

## W8 — Painel Status do Jogo

**Objetivo:** circuito de feedback visível — homem vê o jogo dele.

### Escopo

#### Componentes

Rota `/dashboard` com:

- **KPIs** (cards):
  - Hot leads ativos (count)
  - Esfriando (status `active` + > 5d sem `Message` ou `EncounterLog`)
  - Deltas semanais (novos hot leads, conversas mortas)
  - Sugestões aceitas vs ignoradas (taxa, via `UserProfile.winSamples` count e `Message.feedback` se persistido)
  - Encontros logados últimas 4 semanas

- **Cards "Ação sugerida"** — top 3 contatos com sugestão IA contextual:
  ```
  "Bia esfriou (7d sem contato). Sugiro abrir com: ..."
  ```
  Geradas on-demand (cache 1h) via call Sonnet.

- **Weekly digest** — job semanal (cron):
  - Sonnet roda sobre `Message` + `EncounterLog` + `UserProfile` da semana
  - Output: "Esta semana tu mandou bem em X tipo de abertura, errou no padrão Y, próxima semana foca em Z"
  - Persistido como `WeeklyDigest` (nova model) ou notif push
  - Exibido como card no topo do dashboard

#### Reusar

- Skill `dashboard-builder` do MeresOS (Tremor + Chart.js + shadcn) se aplicável.
- Subagent `dashboard-builder` se foi instalado no scope global.

### Schema-First markers

- Migration `create_weekly_digest`:
  ```
  WeeklyDigest {
    id          String   @id @default(cuid())
    userId      String   @map("user_id")
    weekStart   DateTime @map("week_start")
    weekEnd     DateTime @map("week_end")
    summary     String
    highlights  Json     // { wins[], misses[], focusNextWeek[] }
    createdAt   DateTime @default(now()) @map("created_at")

    user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    @@unique([userId, weekStart, weekEnd])
    @@index([userId, weekEnd(sort: Desc)])
    @@map("weekly_digest")
  }
  ```
- Atualizar `docs/DATA-MODEL.md` e `docs/COMPONENT-MAP.md`.

### Gate de saída

- Dashboard carrega < 1s com 50 contatos
- KPIs batem com queries SQL diretas (validação manual)
- Weekly digest gerado e legível em PT-BR
- Nielsen H1-H10 PASS + MOBILE-FIRST PASS

### Agentes responsáveis

- `desenrolo-shell-agent` — UI dashboard (ou delegar pra subagent `dashboard-builder` global se disponível)
- `contacts-agent` — queries agregadas + endpoint
- `coach-llm-agent` — weekly digest prompt + cards "ação sugerida"
- `cron-retention-agent` — job semanal
- `platform-agent` — migration weekly_digest

---

## Convenções de handoff entre waves

Ao fechar uma wave:

1. **Commit final** com mensagem `feat(flirtai): wave WN concluida — <título>`.
2. **Gerar `docs/HANDOFF-WN.md`** seguindo MCI v7.7:
   - `status` (done/blocked/partial)
   - `what-works` (smoke comprovado)
   - `blockers` (se partial)
   - `smoke-criteria` (como validar agora)
   - `done-criteria` (como saber que tá concluído)
   - `next-steps` (linka pra próxima wave)
   - `guard-rails` (o que NÃO mexer)
3. **Atualizar este ROADMAP.md** marcando a wave como `✅ DONE — DD-MM-YYYY` na tabela resumo.
4. **Dev-log curto** em `dev-log/DD-MM-YYYY - Wave WN fechada.md` (replicado pro MeresBrain via hook `meres-sync`).
5. **Auto-handoff** — gerar prompt de continuação pra próxima wave (feedback `auto_handoff_em_fim_de_wave` do auto-memory).

## Convenções de manutenção do roadmap

- **Replanejamento permitido** entre waves, não dentro de uma wave em andamento.
- **Adição de wave nova** vira `W9+` — não renumerar.
- **Cancelamento de wave** marca como `❌ CANCELADA — motivo` na tabela.
- **Wave em pausa** vira `⏸️ PAUSADA — motivo + condição de retomar`.

---

## Anexos

- [DATA-MODEL.md](./DATA-MODEL.md) — schema canônico (Schema-First)
- [COMPONENT-MAP.md](./COMPONENT-MAP.md) — mapa de componentes
- [PROFILE-WATCH.md](./PROFILE-WATCH.md) — doc específica do módulo
- [../.claude/agents/README.md](../.claude/agents/README.md) — squad de 8 subagentes
