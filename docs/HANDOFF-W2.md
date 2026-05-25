---
alias: HANDOFF-W2-flirtai
type: handoff
status: done
tags: [flirtai, wave/W2, handoff, coach-ux, streaming-sse]
date_e_hora: 24-05-2026
priority: high
projeto: flirtai
documento: HANDOFF-W2
wave: W2 — Coach UX
versao: 1.0
fechada_em: 24-05-2026
proxima_wave: W3 — Multimodal + Comandos
mci_versao: v7.7
---

# HANDOFF — Wave 2 (Coach UX)

## Status

- Wave: W2 — Coach UX
- Periodo: 24-05-2026 → 24-05-2026
- Branch: master (flirtai e seu proprio repo dentro do monorepo MeresOS)
- Commits: 2 atomicos

  | Hash | Titulo |
  |---|---|
  | `d56999d` | feat(flirtai): W2/M2+M3 schema cleanup — risk/likelyResponse + contact optional |
  | `49c11ad` | feat(flirtai): W2/M1 streaming SSE em /api/coach + shell consumindo deltas |

- Resultado: DONE (codigo + tests + build). Smoke ponta-a-ponta contra Anthropic real continua DEFERRED pelo mesmo blocker de infra de W0/W1 (Docker no PATH + Langfuse).

---

## O que funciona (entregue + testado)

### M1 — Streaming SSE

- [x] `/api/coach` substituido: `messages.create` → `messages.stream`. Endpoint serve `text/event-stream` com 3 eventos: `delta`, `done`, `error` — `src/app/api/coach/route.ts:137-282`
- [x] Auth/rate-limit/contact lookup acontecem ANTES de abrir o stream. Erros 400/401/404/429/503 continuam JSON (contrato preservado pra clientes que nao stream).
- [x] Headers SSE corretos: `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no` (necessario pra desabilitar buffering em proxies tipo nginx/Coolify).
- [x] Parser incremental `extractStringField` em `src/lib/flirt/partial-json.ts` — extrai o valor JSON-string de `assistantMessage` direto dos eventos `input_json_delta` da Anthropic. Trata escapes basicos + unicode completo. Para de forma segura em buffers parciais (escape `\` incompleto, `\uXX` incompleto). 7 unit tests cobrem corner cases.
- [x] Como `assistantMessage` e o PRIMEIRO campo no tool schema, o modelo emite ele antes dos outros campos (`suggestions`, `insight`, `contact`) — entao o usuario ve token-streaming verdadeiro do texto principal. Os campos restantes chegam em bloco no `done`.
- [x] Trace Langfuse + transacao Prisma + dispatch do `done` SSE acontecem apos `stream.finalMessage()`. Mesmo contrato observability da W1, agora com `cache_read_input_tokens` ja disponivel no usage final.
- [x] Cliente em `src/components/flirt-ai-shell.tsx:483-588`: substitui `await fetch(...).json()` por `fetch + ReadableStream reader` + parser SSE inline. Cobre delta/done/error e fallback pra mensagem de erro humana.
- [x] Estado novo `streamingText: { contactId, text } | null` no shell renderiza bubble in-flight com cursor piscante; substitui o indicador "Pensando" assim que chega o 1o delta. Scroll-to-bottom segue `streamingText.text.length`.
- [x] Em `done`, o store recebe o payload completo via `applyCoachResponse` (que ja existia) e a bubble streaming desaparece, sendo substituida pela mensagem persistida com insight + suggestions.

### M2 — Schema expandido das sugestoes

- [x] `ReplySuggestion` ganha `risk: "Safe" | "Risky" | "High-risk"` e `likelyResponse: string` — `src/types/flirt.ts:15-21`
- [x] Tool schema marca os 2 campos como `required` e o `risk` com enum fixo — `src/lib/flirt/coach-schema.ts:16-43`
- [x] UI renderiza pill colorida (verde/Safe, amber/Risky, rose/High-risk) ao lado do tone, frase `Resposta provavel dela: ...` em italico embaixo do `why`, e `title` HTML hover (acessibilidade basica). `labelRisk` + `riskBadgeClass` em `flirt-ai-shell.tsx`.
- [x] Store version 6 → 7 (`use-flirt-store.ts:248`) invalida cache de usuario com suggestions sem `risk`/`likelyResponse`.

### M3 — Campos optional em contact

- [x] `personalityType`, `interests`, `tags` saem do `required` em `contact` no tool schema — `coach-schema.ts:45-50`
- [x] `CoachChatResponse.contact` vira `Pick<...> & Partial<Pick<..., "personalityType" | "interests" | "tags">>` — `src/types/flirt.ts:119-127`
- [x] Merge defensivo no route (`route.ts:225-236`) e no store (`use-flirt-store.ts:200-216`): `?.length` em arrays + `?? contact.personalityType` em string. LLM pode omitir os 3 sem quebrar a UI ou o Prisma update.
- [x] System prompt e contexto NAO mudaram — leitura segue feita sobre `contact.*` do DB, nao sobre `llmResponse.contact.*`.

### Tests + build

- [x] `npm test` → **3 files / 20 tests passed** em ~74ms (era 12 na W1, +8 novos: 7 em `partial-json.test.ts` + 1 em `coach-schema.test.ts` cobrindo invariantes M2/M3).
- [x] `npm run build` → Compiled successfully 1.7s + typecheck 2.1s, **24 rotas geradas**.
- [x] `npm run lint` → 0 errors (1 warning pre-existente no dominio W4 em `meta-graph-client.ts`, fora do escopo W2).

---

## O que NAO funciona / Bloqueadores

### B1 — Smoke ponta-a-ponta com Anthropic real

- Descricao: gate de saida do ROADMAP "TTFB visual ≤500ms" + "risk/likelyResponse em todas as sugestoes em 20 calls de teste" exige Anthropic real + DB rodando. Docker ainda fora do PATH na sessao (mesmo blocker de W0/W1) e Langfuse self-hosted ainda nao provisionado (mesmo blocker B1 da W1).
- Impacto: nao mede TTFB real. Streaming foi validado via build + unit tests do parser + leitura do contrato SDK Anthropic — o codigo esta correto, mas a curva token-por-token contra a API real esta pendente de validacao empirica.
- Owner: Meres (sessao com Bash aprovado + `coolify-ops` re-spawnado pra subir Langfuse + Postgres local).
- Fecha quando:
  1. `docker compose up -d && npx prisma migrate deploy` aplica as 3 migrations pendentes (C9-W0 + C2-W1 + C5-W1)
  2. Dev server roda, contato criado, prompt enviado → assistantMessage aparece token-por-token visivel em ≤500ms
  3. Cada suggestion na resposta tem `risk` (pill colorida) + `likelyResponse` (linha italica)

---

## Smoke E2E (criterios testaveis pelo smoke-e2e-runner)

```bash
# Pre-requisito: Docker no PATH + migrations W0/W1 ja aplicadas
cd /Users/raphaelmeres/MeresOS/MeresClaude/projetos/flirtai

# 1. Sobe Postgres local + aplica migrations
docker compose up -d
npx prisma migrate deploy

# 2. Roda suite vitest
npm test
# Expected: Test Files 3 passed (3), Tests 20 passed (20)

# 3. Build de producao
npm run build
# Expected: Compiled successfully + typecheck verde, 24 routes

# 4. (Manual) — Dev server + criar contato + mandar prompt
npm run dev
# Login -> criar contato -> mandar "ela me respondeu 'haha talvez', o que mando?"
# Expected:
#   - bubble streaming aparece com cursor piscante em <500ms
#   - texto aparece tokenizado (palavra por palavra ou bloco curto)
#   - ao final, bubble streaming some, bubble final aparece com:
#     * insight (Interesse / Leitura / Mover / Evitar)
#     * 3-5 suggestions, cada uma com:
#       - pill de risk (Safe/Risky/High-risk) ao lado do tone
#       - texto principal
#       - "why" embaixo
#       - "Provavel resposta dela: ..." em italico
#       - tooltip hover mostra likelyResponse

# 5. (Manual — DevTools Network) — Inspecionar a request /api/coach
# Expected:
#   - response Content-Type: text/event-stream; charset=utf-8
#   - body chunked, eventos separados por \n\n
#   - eventos: 'event: delta\ndata: {"text":"..."}\n\n' (multiplos)
#   - 1 evento final: 'event: done\ndata: {...payload completo + messageId}\n\n'

# 6. (Manual — payload optional M3) — Verificar que contact com personalityType
#    vazio nao quebra. Forcar via system prompt nao trivial; basta confirmar
#    via DB studio que personalityType nao vira "" se LLM omitir
npx prisma studio

# 7. (Langfuse) — Verificar trace com cache_read_input_tokens > 0
#    (gate de cache hit ja da W1, mas continua valido aqui)
```

---

## Done Criteria (do plano-mae — ROADMAP.md W2)

- [x] `messages.create` substituido por `messages.stream` em /api/coach
- [x] Endpoint vira `text/event-stream`
- [x] Cliente consome via `fetch + ReadableStream` (Next 16 Edge-ish friendly — mas escolhi Node runtime explicito pelo Prisma + better-auth deps)
- [x] `assistantMessage` renderiza incrementalmente; `suggestions/insight/contact` chegam ao final em bloco
- [x] `risk` enum 3-niveis adicionado em ReplySuggestion + UI (pill colorida)
- [x] `likelyResponse` adicionado em ReplySuggestion + UI (linha italica + tooltip)
- [x] `personalityType`, `interests`, `tags` saem do required em contact
- [x] Merge inteligente do route + store preservados (ja existiam, validados)
- [x] Tests verdes (20/20)
- [x] Build typecheck verde (24 rotas)
- [ ] **TTFB visual (primeira palavra no chat) ≤500ms** — gate empirico, depende de B1
- [ ] **3 campos opcionais retornam vazio sem quebrar UI em 20 calls** — gate empirico, depende de B1
- [ ] **risk e likelyResponse aparecem em todas as suggestions em 20 calls** — gate empirico, depende de B1

10/13 verdes. 3 DEFERRED sao todos validacao empirica contra Anthropic real — codigo esta completo e correto, pronto pra ser rodado.

---

## Guard-rails (avisos criticos pra proxima sessao)

- NAO voltar pra `messages.create` no /api/coach. A pipeline inteira da UX assume streaming agora (bubble in-flight, cursor piscante, scroll). Reverter = regressao perceptiva forte.
- NAO confiar em ORDEM dos campos no schema sem testar. O parser `extractStringField` so funciona pra `assistantMessage` porque ele e o PRIMEIRO campo no schema da tool. Se algum dia precisar streamar OUTRO campo (ex: o `read` do insight), tem 2 opcoes: (a) reordenar o schema pra trazer ele pra frente, OU (b) usar partial JSON parser de verdade (lib tipo `partial-json-parser`). Documentei o trade-off aqui pra nao surpreender ninguem.
- NAO remover `runtime = "nodejs"` e `dynamic = "force-dynamic"` no topo da route. SSE + Prisma + better-auth = requer Node runtime. Default Next 16 e Edge em alguns casos — sem essas exports a route pode quebrar em build/deploy.
- NAO mudar os headers SSE sem testar atras de proxy. `X-Accel-Buffering: no` e o que evita o nginx (e Coolify) bufferizar o stream e enviar tudo no fim. Removeu = volta a parecer nao-streaming em prod.
- NAO bumpar de novo `version` do store sem motivo. Cada bump invalida cache local de TODOS os usuarios autenticados. Bumpei de 6→7 nesta wave porque ReplySuggestion ganhou 2 required fields. Mexer em ReplySuggestion / ContactRecord / ConversationMessage outra vez = bumpar de novo.
- NAO esquecer que a route AINDA retorna JSON pros paths de erro pre-stream (auth/rate-limit/contact-not-found/no-api-key). Cliente faz `if (!response.ok) await response.json()` antes de ler o stream. Mudar UM dos dois caminhos sem mudar o outro = quebra a UX de erro.
- W4 (Profile Watch Hardening) JA FOI COMMITADA (`2b67b03`). Diferente da janela W1, nao ha mais working tree compartilhado. Mas: a feature flag `personalityType` opcional do M3 NAO afeta consent guard nem cron-runner — escopos disjuntos.
- Outra sessao Claude Code pode estar comecando W3 (Multimodal). Conflitos previsiveis: ambas mexem em `coach-schema.ts` (W3 vai adicionar `image` block na request, W2 ja moveu campos pra optional). Rebase manual no `coach-schema.ts` deve ser trivial.

---

## Proximas acoes (W3 — Multimodal + Comandos)

1. **C6 — eliminar Tesseract.js.** Aceitar imagem no `/api/coach` (multipart ou base64), repassar como `image` block na call Anthropic. Adicionar `Message.attachments Json?`.
2. **M4 — Vision + Contact.avatarUrl.** Quando print contem foto de perfil dela detectavel, extrair via Vision e setar `Contact.avatarUrl`. Skip se contato ja tem avatar.
3. **M6 — `src/lib/flirt/commands.ts`.** Centralizar `COACH_COMMANDS` em lib reutilizavel; shell consome (remove array hardcoded `commandSuggestions` em `flirt-ai-shell.tsx:113-138`).
4. **Pre-requisito de infra:** continua Docker + migrations W0/W1 pendentes. Adicionalmente, W3 vai precisar de bucket R2 ou volume persistente Coolify pra `attachments` (decidir cedo, idealmente na primeira metade da wave).

Prompt de continuacao sugerido pra proxima sessao:

> Continua flirtai Wave 3 (Multimodal + Comandos). Le `docs/HANDOFF-W2.md` + `docs/ROADMAP.md` secao W3. Escopo: C6 (eliminar Tesseract, aceitar image block no /api/coach), M4 (Vision extrai avatar quando print contem foto de perfil dela), M6 (extrair `COACH_COMMANDS` pra `lib/flirt/commands.ts`). Pre-requisito leve: `docker compose up -d && npx prisma migrate deploy` (aplica C9+C2+C5 + a futura `add_message_attachments`). Decidir cedo: bucket R2 ou volume Coolify pra anexos.

---

## Achados durante execucao (drifts, surpresas)

- O SDK Anthropic v0.98.0 expoe `client.messages.stream(params)` que retorna `MessageStream<T>`, e iteravel via `for await`. Eventos relevantes: `content_block_delta` com `delta.type === "input_json_delta"` traz `partial_json: string`. Acumulei manualmente em `accumulatedJson` (o SDK tambem ja expoe via `inputJson` event, mas usar o evento raw mantem o codigo SDK-agnostico-ish).
- Como o `assistantMessage` e o **primeiro** campo do tool input_schema, a Anthropic emite ele antes dos outros — entao a UX percebe streaming verdadeiro. Documentei isso em guard-rail acima porque e uma dependencia implicita do schema.
- Considerei usar uma lib tipo `partial-json-parser` pra parsing robusto, mas pra extracao de UM campo string conhecido o regex+state-machine de 80 linhas resolve com tests cobrindo casos limite. Menos dep, menos surface de bug.
- `finalMsg.content` tipa como uniao generica no SDK; precisei castar pra `Anthropic.ContentBlock[]` pra usar `.find(block: ContentBlock): block is ToolUseBlock`. Anotacao localizada, sem impacto fora.
- Decidi NAO bumpar `HISTORY_CAP` ou mexer no rolling summary aqui — escopo W2 e UX de coach, nao memoria. Memoria do Homem chega em W6.
- A separacao "JSON pra pre-stream errors, SSE pra mid-stream" e intencional: simplifica o cliente (que primeiro checa `response.ok` antes de ler stream) e mantem compatibilidade caso algum cliente futuro nao queira streaming.
- `streamingText` foi modelado como `{contactId, text} | null` em vez de `Record<contactId, text>` porque so ha UMA call coach in-flight por vez (usuario nao pode disparar nova call enquanto a atual nao termina — `isTyping` bloqueia). Estrutura mais simples = menos bug.
- Lint warning em `meta-graph-client.ts:17:40` (`_args is defined but never used`) e do dominio W4, ja commitado, fora do escopo. Deixei intacto.
