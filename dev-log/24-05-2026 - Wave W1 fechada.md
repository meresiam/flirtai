---
alias: dev-log-flirtai-W1-fechada
type: dev-log
status: done
tags: [flirtai, wave/W1, dev-log, coach-reliability]
date_e_hora: 24-05-2026
priority: normal
projeto: flirtai
wave: W1 — Coach Reliability
mci_versao: v7.7
---

# Dev-log — Wave W1 fechada (partial)

**Data:** 24-05-2026
**Wave:** W1 — Coach Reliability
**Status final:** PARCIAL (codigo 100% entregue, 3 gates de infra DEFERRED)

---

## O que entrou

5 commits atomicos entregaram todos os itens de codigo do escopo W1:

- **C1** — `statusToDb()` wired em `/api/coach` e `PATCH /api/contacts/[id]`. +4 testes de regressao. Eliminou o `if/else` inline que era fonte do bug de status parsing.
- **C2** — `User.anthropicApiKeyEncrypted` (nullable). Settings PATCH criptografa via `encryptToken`, GET retorna mask `••••••••`. Coach route decifra com fallback pra env. Reusou `token-crypto.ts` do Profile Watch.
- **C4** — System prompt com `cache_control: { type: "ephemeral" }`. Cache pre-computado do system prompt em todos os turns — reducao de custo esperada ≥40% (validacao pendente no Langfuse).
- **C5** — `HISTORY_CAP` elevado 8 → 20. Rolling summary via Haiku 4.5 quando `messages.count > 30`. `Contact.conversationSummary` novo campo (migration gerada). Helper `generateConversationSummary` injeta no contexto se existir.

**Testes:** 12/12 verde, ~130ms. **Build:** 2.2s + typecheck 3.1s, 24 rotas.

---

## O que ficou DEFERRED

Os mesmos 3 blockers de infra da W0 continuam abertos:

- **B1** — Langfuse nao provisionado no Coolify (precisa de sessao com Bash aprovado para `coolify-ops`).
- **B2** — Migrations nao aplicadas no DB local (Docker fora do PATH). Para fechar: `docker compose up -d && npx prisma migrate deploy`.
- **B3** — Smoke E2E depende de B2.

Nenhum bloqueia W2 no codigo.

---

## Proxima wave

W2 — Coach UX: streaming SSE (M1) + schema expandido de sugestoes com `risk` + `likelyResponse` (M2) + campos opcionais no tool (M3).

Handoff completo: `docs/HANDOFF-W1.md`
