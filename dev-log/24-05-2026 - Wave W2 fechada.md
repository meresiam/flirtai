---
alias: dev-log-flirtai-W2-fechada
type: dev-log
tags: [flirtai, wave/W2, coach-ux, streaming-sse, dev-log]
date_e_hora: 24-05-2026
projeto: flirtai
status: done
wave: W2 — Coach UX
mci_versao: v7.7
---

# Wave W2 fechada — Coach UX (streaming + schema cleanup)

## TL;DR

W2 entregue + verde em **uma sessao** (24-05-2026). 2 commits atomicos. 20 testes verdes (12 → 20, +8 novos). Build typecheck 2.1s, 24 rotas. 3 gates empiricos ficaram DEFERRED pelo mesmo blocker de infra das waves anteriores (Docker no PATH + Anthropic real + Langfuse).

## Entregaveis

### M1 — Streaming SSE

- `messages.create` → `messages.stream` no `/api/coach`
- Response `text/event-stream` com 3 eventos: `delta`, `done`, `error`
- Parser incremental `extractStringField` extrai `assistantMessage` dos eventos `input_json_delta` (7 unit tests cobrindo escapes parciais, unicode parcial)
- Bubble de streaming com cursor piscante no shell, substitui o "Pensando" assim que o 1o delta chega
- Auth/rate-limit ainda JSON antes do stream (contrato pre-stream preservado)

### M2 — Schema expandido suggestions

- `ReplySuggestion` ganha `risk: Safe/Risky/High-risk` + `likelyResponse: string`
- Pill colorida (verde/amber/rose) + linha italica + `title` HTML hover

### M3 — Campos optional contact

- `personalityType`, `interests`, `tags` saem do required em tool schema
- Route + store merge defensivo com `?.length` e `??`
- Store version 6 → 7 invalida cache antigo

## Commits

- `d56999d` — W2/M2+M3 schema cleanup
- `49c11ad` — W2/M1 streaming SSE + UI

## Gates do ROADMAP

| Criterio | Status |
|---|---|
| `messages.stream` no /api/coach | ✅ |
| text/event-stream + SSE deltas | ✅ |
| Cliente consome via ReadableStream | ✅ |
| `assistantMessage` incremental + bloco final | ✅ |
| `risk` 3-niveis | ✅ |
| `likelyResponse` em UI | ✅ |
| Campos opcionais em contact | ✅ |
| Tests verdes (20/20) | ✅ |
| Build typecheck verde (24 rotas) | ✅ |
| TTFB visual ≤500ms | DEFERRED — empirico |
| 3 campos opcionais retornam vazio sem quebrar UI em 20 calls | DEFERRED — empirico |
| risk/likelyResponse em todas suggestions em 20 calls | DEFERRED — empirico |

10/13 verdes. 3 DEFERRED dependem de Docker + Anthropic real, que continua sendo o mesmo blocker de W0/W1.

## Surpresas

- O streaming token-por-token de `assistantMessage` so funciona porque ele e o PRIMEIRO campo no tool schema. Documentei em guard-rail no HANDOFF.
- SDK Anthropic v0.98 expõe `client.messages.stream()` iteravel via `for await` — pattern direto, sem fricção.
- Parser de partial JSON em 80 linhas com 7 tests cobriu tudo que precisei. Nao precisei de lib externa.

## Proximo

W3 — Multimodal + Comandos (C6 elimina Tesseract, M4 Vision pra avatar, M6 commands.ts lib).

Handoff completo: `docs/HANDOFF-W2.md`.
