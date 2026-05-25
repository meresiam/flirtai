---
alias: dev-log-flirtai-W4-fechada
type: dev-log
status: done
tags: [flirtai, wave/W4, dev-log, profile-watch, consent, retry-exponencial, hardening]
date_e_hora: 24-05-2026
priority: normal
projeto: flirtai
wave: W4 — Profile Watch Hardening
mci_versao: v7.7
---

# Dev-log — Wave W4 fechada

**Data:** 24-05-2026
**Wave:** W4 — Profile Watch Hardening
**Status final:** ENTREGUE (codigo completo + build verde + Nielsen auditado; smoke E2E autenticado pendente Meres)

---

## O que foi entregue

**C8 — Consent versioning guard (escopo formal)**

Guard centralizado em `src/lib/profile-watch/consent-guard.ts` bloqueia scan e PATCH de cadencia quando `MonitoredProfile.consentVersion !== CURRENT_CONSENT_VERSION`. Retorna 409 com `reacceptUrl`. PATCH `{status:"paused"}` e DELETE passam incondicionalmente (LGPD). Endpoint `PATCH /api/profiles/[id]/consent` criado para registrar o reaceite. UI em `src/app/profiles/[id]/page.tsx` intercepta 409 e query `?reaccept=consent` para abrir `ConsentDialog` em modo `reaccept`.

**M7 — Retry exponencial no cron (escopo formal)**

`cron-runner.ts` agora tem try/catch em cada scan. Falha: `errorCount++`, `nextScanAt = now + min(errorCount, 12) * 2h` (cap 24h). Sucesso: `errorCount = 0`, volta para `cadenceHours`. Falha de report (LLM/notif) nao penaliza o scheduler se o scan Apify sucedeu.

**Schema** — migration `20260524235721_add_profile_error_count` aplicada. `MonitoredProfile.errorCount Int @default(0) @map("error_count")`. Invariante do cap documentada em `docs/DATA-MODEL.md`.

**Debito W1 fechado (fora do escopo W4)**

`src/app/api/coach/route.ts` referenciava `user.anthropicApiKey` — campo droppado pela migration W1/C2. Corrigido para `anthropicApiKeyEncrypted` + `decryptToken`. Funcao `generateConversationSummary` (W1/C5) estava ausente do route; implementada inline para destravar o build.

**Audit Nielsen no ConsentDialog (fora do escopo, executado por risco LGPD)**

4 fixes aplicados: H1 loading `isSubmitting`, M3 texto legal `text-sm`/`text-white/65`, H2 data legivel em vez de versao tecnica, H10 description de reaccept menciona o que mudou. 5 FLAGs documentados como debito formal em `docs/NIELSEN-CHECKLIST-w4-reaccept.md`: M2 hitbox, M8 above-the-fold, H9 erro Zod PT-BR, A1 contraste 4.45:1, A3 focus-visible.

## Gates

- `npx tsc --noEmit` → exit 0
- `npm run build` → standalone 25 rotas (incluindo `/api/profiles/[id]/consent` nova)
- `npm run lint` → 0 erros, 1 warning pre-existente
- Nielsen audit → 0 BLOCKs, 9 FLAGs (4 fixados; 5 debito W5/W6)
- E2E autenticado → pendente Meres (requer sessao + Postgres + profile com consentVersion antiga)

## Proxima wave

W5 — Settings & Search expandidos. Ver `docs/ROADMAP.md` e `dev-log/PROMPT-W5.md`.

---

*Handoff completo: `docs/HANDOFF-W4.md`*
