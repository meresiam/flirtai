---
projeto: flirtai
categoria: Pessoais
data: 24-05-2026
tipo: dev-log
wave: W0 — Foundation
status: partial (código done, infra Langfuse + migration apply DEFERRED)
mci_versao: v7.7
tags:
  - flirtai
  - wave-w0
  - foundation
  - testes
  - observability
  - naming-lock
---

# W0 — Foundation — fechada parcial

## O que entregou

- **C9 Naming Lock** — `'hot lead'` → `'hot_lead'` end-to-end. 12 ocorrências em 9 arquivos (TS literal, Zod, coach-schema, system-prompt, UI labels x4, route handlers x2) + `prisma/schema.prisma` (drop `@map`). Migration atômica `ALTER TYPE` versionada. `grep -rn "hot lead" src/` retorna zero.
- **C3 Testes** — vitest config + 8 testes de contrato (coach-schema + serializers) verde em 98ms. Playwright config + smoke E2E `coach-flow.smoke.spec.ts` com mock de `/api/coach` (offline-capable, login → criar contato → enviar mensagem → ver resposta mockada).
- **C7 Observability** — `langfuse@3` instalado + singleton com **graceful no-op** quando env vars ausentes. `traceCoachCall` instrumentado em `/api/coach` (sucesso + erro) com input/output tokens, cache_read/cache_creation, latência, userIdHash FNV-1a. Log JSON estruturado em stdout sempre, independente do Langfuse estar UP.

## Gates verdes

- `npm test` → 2 files / 8 tests passed
- `npm run build` → Compiled successfully 2.2s + Finished TypeScript 4.3s
- `grep -rn "hot lead" src/ prisma/schema.prisma` → vazio

## Gates DEFERRED

- **Migration aplicada em DB local** — Docker não está no PATH desta sessão. Quando subir `docker compose up -d` + `npx prisma migrate dev`, aplica num passo. Risco zero (rename atômico).
- **Langfuse instância UP** — subagent `coolify-ops` travou por falta de permissão Bash. Código está pronto; basta re-spawnar `coolify-ops` na próxima sessão e popular `LANGFUSE_PUBLIC_KEY/SECRET_KEY/BASE_URL` no `.env`.
- **Smoke E2E executado** — depende dos 2 acima + `playwright install chromium`.

## Decisões

- **Observability stack:** Langfuse self-hosted (vs Helicone vs logger-only) — alinhado com skill `aila-agent-stack`.
- **Migration strategy:** `ALTER TYPE ... RENAME VALUE` direto (vs expand-contract) — Postgres 10+ suporta rename atômico, DB dev fresh sem prod ativo, risco zero.
- **Test runner:** vitest (vs jest) — defaults do roadmap, mais rápido em Next 16 + Turbopack.
- **E2E framework:** Playwright (vs Cypress) — defaults do roadmap.

## Pegadinha encontrada

Bug de typecheck capturado pelo `next build` antes de qualquer commit: confundi `input` (CoachTraceInput) com `output` (CoachTraceOutput) no `lf.trace.generation`. Os tokens vivem no `output` (resposta da Anthropic), não no `input` (metadata do trace). Fix de 6 chars resolveu. Confirma o valor do typecheck como gate.

## Próximo passo

W1 — Coach Reliability. Prompt de continuação no `docs/HANDOFF-W0.md` seção "Next steps". Pré-requisito leve: aplicar migration C9 + (opcional) subir Langfuse antes de C4 (cache_read tokens).

## Artefatos

Ver `docs/HANDOFF-W0.md` — seção "Artefatos gerados".
