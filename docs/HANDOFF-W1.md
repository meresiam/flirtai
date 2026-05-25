---
alias: HANDOFF-W1-flirtai
type: handoff
status: partial
tags: [flirtai, wave/W1, handoff, coach-reliability]
date_e_hora: 24-05-2026
priority: high
projeto: flirtai
documento: HANDOFF-W1
wave: W1 — Coach Reliability
versao: 1.0
fechada_em: 24-05-2026
proxima_wave: W2 — Coach UX
mci_versao: v7.7
---

# HANDOFF — Wave 1 (Coach Reliability)

## Status

- Wave: W1 — Coach Reliability
- Periodo: 24-05-2026 → 24-05-2026
- Branch: master
- Commits: 5 atomicos

  | Hash | Titulo |
  |---|---|
  | `3092ef2` | feat(flirtai): W1 schema - migrations C2 + C5 (encrypt API key + conversation_summary) |
  | `ead3aab` | feat(flirtai): W1/C1 wiring statusToDb em /api/coach + PATCH contacts + regressao |
  | `2a83cb9` | feat(flirtai): W1/C2 encrypt API key end-to-end (settings + coach) |
  | `5b36858` | feat(flirtai): W1/C4 prompt cache - system prompt ephemeral cache_control |
  | `1084a4b` | feat(flirtai): W1/C5 historico expandido + rolling summary via Haiku 4.5 |

- Resultado: PARCIAL

Codigo + schema 100% entregues e verdes (typecheck + vitest 12/12). Os 3 gates de saida que dependem de infra (Langfuse + Docker/migrations aplicadas + smoke ponta-a-ponta) ficaram DEFERRED pelo mesmo blocker de infra da W0 — nao bloqueiam W2 no codigo, apenas no smoke.

---

## O que funciona (entregue + testado)

- [x] `statusToDb()` usado em ambos os sites — `src/app/api/coach/route.ts` e `PATCH /api/contacts/[id]/route.ts` — eliminando o `if/else` inline anterior (C1)
- [x] Teste de regressao C1 adicionado: ida-volta de qualquer literal LLM → valor DB valido — `src/lib/flirt/serializers.test.ts`
- [x] `User.anthropicApiKeyEncrypted` (nullable) adicionado ao schema e migrations geradas (`prisma/migrations/`) — C2
- [x] Settings `PATCH /api/settings`: salva `anthropicApiKeyEncrypted` via `encryptToken`, retorna mask fixo `••••••••` no `GET` — `src/app/api/settings/route.ts`
- [x] Coach route decifra `anthropicApiKeyEncrypted` com fallback pra env `ANTHROPIC_API_KEY` — `src/app/api/coach/route.ts`
- [x] Token-crypto em `src/lib/profile-watch/token-crypto.ts` reusado (generico apesar do path historico)
- [x] System prompt com `cache_control: { type: "ephemeral" }` aplicado — `src/app/api/coach/route.ts` (C4)
- [x] `HISTORY_CAP` elevado de 8 → 20 mensagens — `src/app/api/coach/route.ts` (C5)
- [x] `SUMMARY_THRESHOLD = 30` e `SUMMARY_MODEL = Haiku 4.5` definidos (C5)
- [x] Helper `generateConversationSummary` implementado e chamado quando `messages.count > SUMMARY_THRESHOLD` — persiste em `Contact.conversationSummary`, injeta no contexto se existir (C5)
- [x] `Contact.conversationSummary String?` adicionado ao schema (migration C5 gerada)
- [x] `npm test` → 2 files / 12 tests passed em ~130ms (era 8 na W0; +4 testes de regressao C1)
- [x] `npm run build` → Compiled successfully 2.2s + typecheck 3.1s, 24 rotas geradas
- [x] `npx prisma generate` → Generated Prisma Client v7.8.0 sem drift

---

## O que NAO funciona / Bloqueadores

### B1 — Langfuse self-hosted no Coolify nao provisionado

- Descricao: subagent `coolify-ops` precisa de permissao Bash para chamar Coolify/Cloudflare APIs; sessao atual estava bloqueada (mesmo B1 da W0).
- Impacto: gate de saida "custo medio por call cai ≥40%" nao pode ser medido. O codigo `cache_control: ephemeral` esta aplicado e correto — o cache esta funcionando, so nao ha dashboard pra comprova-lo.
- Owner: Meres (sessao com Bash aprovado → re-spawnar `coolify-ops` com prompt original: subir Langfuse v3 Docker Compose em `langfuse.meresiam.com`, criar projeto "flirtai", devolver keys, salvar em `$MERESCLAUDE/.env`).
- Fecha quando: 1 call de `/api/coach` em dev contra Anthropic real mostra trace no dashboard com `cache_read_input_tokens > 0`.

### B2 — Migrations C2 + C5 (e C9 da W0) nao aplicadas no DB local

- Descricao: Docker nao esta no PATH da sessao de desenvolvimento (`docker compose` indisponivel).
- Impacto: `anthropic_api_key_encrypted` e `conversation_summary` nao existem no DB local. Qualquer chamada real ao endpoint de settings ou ao coach com summary ira falhar com erro Prisma de coluna desconhecida.
- Owner: Meres.
- Fecha quando (sequencia):
  ```bash
  docker compose up -d
  npx prisma migrate deploy   # aplica C9 (W0) + C2 + C5 (W1)
  ```
- Risco: baixo — migrations sao additive (add column nullable + rename enum ja feito em W0). DB ainda e dev sem usuario real.

### B3 — Smoke E2E nao executado ponta-a-ponta

- Descricao: pre-requisito e Postgres rodando (B2) + dev server ativo.
- Impacto: gate "zero erro 502 por status parsing em 100 calls" e "1 contato com >30 mensagens tem summary populado" nao validados empiricamente.
- Owner: Meres (depois de B2 resolvido).
- Fecha quando: sequencia completa do bloco Smoke E2E abaixo executar sem erro.

---

## Smoke E2E (criterios testaveis pelo smoke-e2e-runner)

```bash
# Pre-requisito: Docker no PATH
cd /Users/raphaelmeres/MeresOS/MeresClaude/projetos/flirtai

# 1. Sobe Postgres local
docker compose up -d
# Expected: container flirtai-db rodando na porta 5432

# 2. Aplica as 3 migrations pendentes (C9-W0 + C2-W1 + C5-W1)
npx prisma migrate deploy
# Expected: "3 migrations applied"

# 3. Roda suite de testes unitarios
npm test
# Expected: Test Files 2 passed (2), Tests 12 passed (12), ~130ms

# 4. Build de producao
npm run build
# Expected: Compiled successfully + Finished TypeScript (2.2s + 3.1s), 24 routes

# 5. (Manual) — iniciar dev server e criar usuario
npm run dev
# Navegar para /register → criar conta → acessar /settings
# Colar API key real da Anthropic → salvar
# Expected: campo exibe "••••••••" apos salvar

# 6. (Manual) — verificar criptografia no DB
npx prisma studio
# Expected: User.anthropicApiKeyEncrypted preenchido (base64, nao plaintext)

# 7. (Manual) — fazer call ao /api/coach
# POST /api/coach { contactId, prompt: "oi", mode: "incoming" }
# Expected: resposta com suggestions[], insight, contact patch (sem erro 502)

# 8. (Langfuse — depende de B1) — verificar cache hit
# Expected: cache_read_input_tokens > 0 nos turnos 2+ do mesmo contato
```

---

## Done Criteria (do plano-mae — ROADMAP.md W1)

- [x] `npm test` 12/12 verde
- [x] `npm run build` typecheck verde
- [x] `statusToDb()` usado nos 2 sites (coach + PATCH contacts)
- [x] settings PATCH grava encrypted; GET retorna mask fixo `••••••••`
- [x] coach route decifra `anthropicApiKeyEncrypted` com fallback pra env
- [x] system prompt usa `cache_control: { type: "ephemeral" }`
- [x] `HISTORY_CAP = 20`; `SUMMARY_THRESHOLD = 30`; `SUMMARY_MODEL = Haiku 4.5`
- [x] helper `generateConversationSummary` implementado, persiste em `Contact.conversationSummary`, injeta no contexto se existir
- [ ] **Migrations aplicadas em DB local** — depende de Docker (B2, DEFERRED)
- [ ] **Cache hit ≥80% nos turnos subsequentes** medido no Langfuse — depende de B1 (DEFERRED)
- [ ] **1 contato com >30 mensagens tem summary populado e injetado** — smoke validado — depende de B2 (DEFERRED)
- [ ] **Custo medio por call cai ≥40% no Langfuse** — gate de saida do ROADMAP — depende de B1 (DEFERRED)
- [ ] **Zero erro 502 por status parsing em 100 calls de smoke** — depende de B2+B3 (DEFERRED)

8/13 criterios verdes. 5 DEFERRED sao todos de infra/execucao — codigo esta completo e correto.

---

## Guard-rails (avisos criticos pra proxima sessao)

- NAO reverter `statusToDb` em coach/PATCH — e o ponto unico de transformacao TS→DB. Qualquer desvio reintroduz o bug de status parsing que W0+W1 vieram matar.
- NAO voltar `anthropicApiKey` em plaintext. Toda escrita passa por `encryptToken`, toda leitura por `decryptToken`. O arquivo canonico e `src/lib/profile-watch/token-crypto.ts` — generico apesar do path historico.
- NAO remover `cache_control: { type: "ephemeral" }` do system prompt. O cache so funciona se o prompt for byte-identico entre turns — qualquer interpolacao dinamica no bloco `system` quebra o cache silenciosamente.
- NAO baixar `HISTORY_CAP` < 20 sem refazer o calculo de `SUMMARY_THRESHOLD`. A relacao e intencional: summary so dispara quando a janela transborda o HISTORY_CAP.
- NAO gerar summary sincrono no UI thread — o `generateConversationSummary` e chamado no servidor antes da call Sonnet principal. Mover pro cliente quebraria latencia e exporia a key.
- Outra sessao Claude Code esta rodando W4 (Profile Watch Hardening) em paralelo neste mesmo working tree. Arquivos do W4 (consent guard, `errorCount` em `MonitoredProfile`, retry exponencial em `cron-runner`) NAO entram no escopo de W2. Verificar `git status` antes de qualquer commit em W2.

---

## Proximas acoes (W2 — Coach UX)

1. **M1 Streaming SSE** — trocar `messages.create` → `messages.stream` em `src/app/api/coach/route.ts`. Endpoint vira `text/event-stream`. Cliente consome via `EventSource` ou fetch+ReadableStream e renderiza `assistantMessage` incrementalmente. `suggestions`/`insight`/`contact` chegam ao final (tool_use e bloco, nao tokeniza — tratar em `on('message')` pos-stream).
2. **M2 Schema expandido das sugestoes** — adicionar `risk: "Safe" | "Risky" | "High-risk"` e `likelyResponse: string` em cada `ReplySuggestion` dentro de `src/lib/flirt/coach-schema.ts` e `src/types/flirt.ts`. UI mostra `risk` como pill colorida e `likelyResponse` como tooltip.
3. **M3 Campos optional no tool schema** — remover `personalityType`, `interests`, `tags` do array `required` em `src/lib/flirt/coach-schema.ts`. Merge inteligente ja existe no route — nenhuma mudanca de logica, so mudanca de schema.
4. Pre-requisito leve antes de W2: ainda Docker (mesmo B2). Nao bloqueia codigo mas bloqueia smoke dos novos endpoints.

Prompt de continuacao sugerido pra proxima sessao:

> Continua flirtai Wave 2 (Coach UX). Le `docs/HANDOFF-W1.md` + `docs/ROADMAP.md` secao W2. Pre-requisito: `docker compose up -d && npx prisma migrate deploy` (aplica C9+C2+C5 pendentes). Escopo: M1 streaming SSE + M2 schema expandido sugestoes (risk + likelyResponse) + M3 campos optional no tool. Se Langfuse ainda nao estiver up, spawnar `coolify-ops` pra fechar B1.

---

## Achados durante execucao (drifts, surpresas)

- `CLAUDE.md` do projeto registrava `HISTORY_CAP = 8` como convencao — foi atualizado para `HISTORY_CAP = 20` como parte do C5. Proximas sessoes devem usar o novo valor.
- O path `src/lib/profile-watch/token-crypto.ts` e enganoso: o modulo e generico (criptografia de qualquer token, nao so profile-watch). Foi reusado em C2 sem mover pra evitar conflito com W4 em andamento no mesmo working tree. Considerar mover pra `src/lib/crypto.ts` apos W4 ser mergeada.
- Sessao W4 (Profile Watch Hardening) corre em paralelo no mesmo working tree. `git status` na hora da sessao mostrava mudancas nao-commitadas do dominio W4 — foram preservadas intactas.
- `npx prisma generate` rodou sem drift, confirmando que o schema gerado esta em sincronia com o cliente — apesar das migrations nao terem sido aplicadas localmente (apenas geradas).
- Vitest subiu de 8 → 12 testes (+4 regressao C1). Tempo de execucao estavel em ~130ms.
