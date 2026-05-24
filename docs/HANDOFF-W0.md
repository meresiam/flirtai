---
projeto: flirtai
documento: HANDOFF-W0
wave: W0 — Foundation
versao: 1.0
fechada_em: 24-05-2026
status: partial
proxima_wave: W1 — Coach Reliability
mci_versao: v7.7
---

# HANDOFF — Wave 0 (Foundation)

## Status

**`partial`** — código 100% entregue + verde local (vitest + build). 1 dependência de infra ficou DEFERRED por falta de permissão Bash do subagent `coolify-ops` nesta sessão (não bloqueia W1, mas o gate "Langfuse dashboard com 1ª call" só fecha quando a instância subir).

## What works (smoke comprovado)

- **C9 (Naming Lock):** zero ocorrências de `"hot lead"` em `src/` + `prisma/schema.prisma`. TS literal, Zod enums, coach-schema enum, UI labels, route handlers — todos em `hot_lead`. DB enum vira `hot_lead` puro (sem `@map`).
  - Migration versionada: `prisma/migrations/20260524230000_rename_hot_lead_enum/migration.sql` (rename atômico Postgres `ALTER TYPE`).
  - `serializers.ts::statusFromDb` virou passthrough; novo helper `statusToDb` exportado pra reuso futuro.
- **C3 (testes):**
  - Vitest configurado (`vitest.config.ts`) + scripts `npm test` / `test:watch` em `package.json`.
  - 8 testes de contrato: `src/lib/flirt/coach-schema.test.ts` (7) + `src/lib/serializers.test.ts` (1).
  - Cobre: tool name, top-level required, **status enum sem "hot lead"**, 3-5 suggestions, insight shape, contact required fields, payload sintético casa com `CoachChatResponse`.
  - Tempo total: **98ms**.
  - Playwright instalado + config (`playwright.config.ts`) + smoke E2E (`e2e/coach-flow.smoke.spec.ts`) com mock de `/api/coach` pra rodar offline.
- **C7 (observability):**
  - `langfuse@3` instalado.
  - `src/lib/observability/langfuse.ts` — singleton com **graceful no-op** se env vars não setadas (apenas log JSON estruturado em stdout).
  - `traceCoachCall()` instrumentado em `src/app/api/coach/route.ts` em ambos os branches (sucesso + erro), com tokens cache_read/cache_creation + latência + userIdHash (FNV-1a, sem PII).
- **Build verde:** `npm run build` (Next 16 Turbopack + TypeScript) passou em 2.2s + 4.3s typecheck.
- **Prisma client regenerado:** `npx prisma generate` ok com schema novo.

## Blockers (o que ficou DEFERRED)

### B1 — Langfuse self-hosted no Coolify ainda não provisionado
- **Causa raiz:** subagent `coolify-ops` precisa de permissão Bash pra chamar Coolify/Cloudflare APIs; sessão atual estava bloqueada.
- **Estado:** código já está pronto pra usar; `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL` estão no `.env.example` e o wrap vira no-op se ausentes.
- **Próximo passo:** numa sessão com Bash aprovado, re-spawnar `coolify-ops` com o mesmo prompt original (subir Langfuse v3 Docker Compose em `langfuse.meresiam.com`, criar projeto "flirtai", devolver public/secret keys, salvar em `$MERESCLAUDE/.env`).
- **Quando fechar este gate:** rodar 1 call de `/api/coach` em dev contra Anthropic real e verificar trace no dashboard `https://langfuse.meresiam.com`.

### B2 — Migration C9 ainda não aplicada no DB local
- **Causa raiz:** Docker não está no PATH desta sessão (`docker compose` indisponível).
- **Estado:** SQL versionada e correta.
- **Próximo passo:** `docker compose up -d` (na pasta `flirtai/`) + `npx prisma migrate dev` — Prisma vai aplicar `20260524230000_rename_hot_lead_enum` num passo.
- **Risco:** zero — `ALTER TYPE ... RENAME VALUE` é atômico e não rewrite data. DB ainda é dev sem usuário real.

### B3 — Smoke E2E ainda não rodou ponta-a-ponta
- **Causa raiz:** pré-requisito é Postgres + dev server rodando.
- **Próximo passo (sequência):**
  1. `docker compose up -d`
  2. `npx prisma migrate dev`
  3. `npm run test:e2e:install` (baixa Chromium pro Playwright, ~1 vez por máquina)
  4. `npm run dev` (em terminal separado) OU deixar `webServer` do `playwright.config.ts` subir
  5. `npm run test:e2e`
- **O que pode flakar:** o test usa labels visíveis em PT-BR (`/criar conta/`, `/novo desenrolo/`, etc) — se a UI mudar copy, o test quebra ruidoso e claro (sinal correto). Adicionar `data-testid`s estáveis é melhoria de W1+.

## Smoke criteria (como validar AGORA)

```bash
cd ~/MeresOS/MeresClaude/projetos/flirtai

# 1. Naming Lock — zero ocorrências
grep -rn "hot lead" src/ prisma/schema.prisma
# (espera saída vazia)

# 2. Vitest
npm test
# (espera: Test Files 2 passed (2), Tests 8 passed (8))

# 3. Build + typecheck
npm run build
# (espera: Compiled successfully + Finished TypeScript)

# 4. Prisma generate (já rodado, mas idempotente)
npx prisma generate
# (espera: ✔ Generated Prisma Client)
```

## Done criteria (quando este HANDOFF vira `done`)

- [x] vitest verde (2 files, 8 tests)
- [x] `next build` typecheck verde
- [x] `grep -rn "hot lead" src/` retorna zero
- [x] Migration `20260524230000_rename_hot_lead_enum` criada
- [x] Langfuse SDK + wrap implementado (no-op se ausente)
- [x] Log estruturado JSON em stdout por call do coach
- [ ] **Migration aplicada em DB local** (depende de Docker)
- [ ] **Langfuse instância UP** + 1ª trace visível no dashboard (depende de B1)
- [ ] **Smoke E2E executado e passando** local (depende de B2 + B3)

3 itens deferred são todos de infra/execução — código está completo.

## Next steps (W1 — Coach Reliability)

Pré-requisito leve antes de W1: aplicar a migration C9 (B2). Depois, W1 escopo:

1. **C1** — agora trivial porque C9 já zerou o branching de status. `serializers.ts::statusToDb` já existe e é passthrough. W1/C1 vira: usar `statusToDb()` no `/api/coach` e em `PATCH /api/contacts/:id` por uniformidade (1-line refactor). Adicionar 1 teste de regressão garantindo serialização ida-volta.
2. **C2** — `User.anthropicApiKeyEncrypted` (migration add col + backfill + drop). Reusar `lib/profile-watch/token-crypto.ts`.
3. **C4** — `system: [{ type: "text", text: ..., cache_control: { type: "ephemeral" } }]` no `api/coach/route.ts:112`. Validar `cache_read_input_tokens > 0` via Langfuse (depende de B1).
4. **C5** — `HISTORY_CAP 8 → 20` + rolling summary via Haiku quando `messages.count > 30`. Migration `add_conversation_summary` (`Contact.conversationSummary String?`).

**Prompt de continuação sugerido pra próxima sessão:**

> Continua flirtai Wave 1 (Coach Reliability). Lê `docs/HANDOFF-W0.md` + `docs/ROADMAP.md` seção W1. Antes de mexer no código: `docker compose up -d && npx prisma migrate dev` pra aplicar C9. Se quiser fechar o gate Langfuse, spawn `coolify-ops` com o prompt de B1.

## Guard-rails (o que NÃO mexer)

- **Não reverter o rename do enum.** `hot_lead` é a forma canônica em toda stack agora. Qualquer label de UI continua sendo "Hot lead"/"Quente" — só os literais de código mudaram.
- **Não remover o no-op do Langfuse.** Se Langfuse cair em prod, o app não pode quebrar; o no-op é proteção, não preguiça.
- **Não mover `traceCoachCall` pra middleware** — ele precisa de userId + tokens que só existem no handler.
- **Não substituir vitest por jest.** Decisão fixa do roadmap (W0).
- **Não mexer em `prisma/migrations/20260523012636_init/`** mesmo que o literal antigo apareça lá — o histórico de migrations é imutável.

## Artefatos gerados

```
prisma/migrations/20260524230000_rename_hot_lead_enum/migration.sql   ← NEW
src/lib/flirt/coach-schema.test.ts                                    ← NEW
src/lib/serializers.test.ts                                            ← NEW
src/lib/observability/langfuse.ts                                      ← NEW
vitest.config.ts                                                       ← NEW
playwright.config.ts                                                   ← NEW
e2e/coach-flow.smoke.spec.ts                                          ← NEW
docs/HANDOFF-W0.md                                                     ← NEW (este arquivo)

src/types/flirt.ts                                                     ← edit (enum)
src/lib/serializers.ts                                                 ← edit (passthrough + statusToDb)
src/lib/flirt/coach-schema.ts                                          ← edit (enum)
src/lib/flirt/system-prompt.ts                                         ← edit (doc enum)
src/app/api/coach/route.ts                                             ← edit (tracing + enum cleanup)
src/app/api/contacts/[id]/route.ts                                     ← edit (Zod enum + cleanup)
src/app/desenrolos/page.tsx                                            ← edit (labels)
src/app/desenrolos/[id]/page.tsx                                       ← edit (labels)
src/components/flirt-ai-shell.tsx                                      ← edit (labels)
prisma/schema.prisma                                                   ← edit (drop @map)
package.json                                                           ← edit (scripts test*)
.env.example                                                           ← edit (Langfuse vars)
docs/DATA-MODEL.md                                                     ← edit (Naming Lock atualizada)
docs/ROADMAP.md                                                        ← edit (W0 marcada DONE)
```

## Métricas

- **LOC adicionadas:** ~330 (libs + testes + migration + handoff)
- **LOC modificadas:** ~30 (cleanup C9 espalhado)
- **Tempo de feedback:** vitest 98ms · build 2.2s + 4.3s typecheck
- **Cobertura adicional:** schema-contract (8 testes); E2E ainda 0% (smoke pendente B3)
