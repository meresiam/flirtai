---
fixed_at: 2026-05-24T23:30:00Z
review_path: docs/REVIEW-W3.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
build: ok
---

# Code Review Fix Report — W3

**Fixed at:** 2026-05-24T23:30:00Z
**Source review:** `docs/REVIEW-W3.md`
**Iteration:** 1
**Scope:** `critical_warning` (CR-01 + WR-01..WR-06)

**Summary:**
- Findings in scope: 7
- Fixed: 7
- Skipped: 0
- Build (`npm run build`): Compiled successfully

## Baseline notes (sessão paralela W5)

Durante o fix run, uma sessão paralela trabalhando em W5/M5/M8 estava ativa
no mesmo working tree. Achados/decisões relevantes:

- A baseline da `src/app/api/coach/route.ts` já tinha as 2 linhas W5
  injetadas (`coachTone: true` no select + `buildSystemPromptParts(mode, user?.coachTone ?? null)`),
  todas commitadas em `f36d57f` (W5/M8 settings). Como a função
  `buildSystemPrompt`/`buildSystemPromptParts` foi atualizada na mesma wave
  pra aceitar `coachTone`, NÃO houve necessidade de cleanup descrito no
  alerta — baseline já casava.
- Durante a aplicação do CR-01, a sessão paralela commitou WR-01..WR-04
  dela (W5 findings, escopo diferente). Por coincidência de timing, meu
  staged-diff de CR-01 entrou junto no commit `d23d096` da sessão paralela
  (que está mislabeled como "WR-03 share locale/timezone enums"). O diff
  do CR-01 está visível no `git show d23d096 -- src/app/api/coach/route.ts`
  e funcionalmente está aplicado no tree. Não há ação de cleanup necessária
  — apenas registro pra rastreabilidade.
- Subsequentemente (WR-01 a WR-06 do REVIEW-W3) foram todos commitados
  atomicamente pelo code-fixer em commits separados.

## Fixed Issues

### CR-01: Body cap ausente — request POST /api/coach aceita ~28MB de JSON
**Files modified:** `src/app/api/coach/route.ts`
**Commit:** `d23d096` (mislabeled — ver "Baseline notes"; diff funcional aplicado)
**Applied fix:** Adicionado `MAX_REQUEST_BYTES = 30 * 1024 * 1024` + short-circuit 413
via `Content-Length` header ANTES de `await request.json()`. Cobre o vetor típico
de DoS (curl/fetch com body pre-calculado). Conforme recomendação do review,
NÃO mexido em `MAX_ATTACHMENT_BYTES` nem `MAX_ATTACHMENTS_PER_TURN` (fora do
escopo automático).

### WR-01: Memory leak — `URL.createObjectURL` não revogada no unmount
**Files modified:** `src/components/flirt-ai-shell.tsx`
**Commit:** `be85450`
**Applied fix:** Introduzido `attachmentsRef = useRef<ImageAttachmentState[]>([])`
+ effect espelho `[attachments]` que atualiza o ref. O cleanup effect `[]`
(que continua com `eslint-disable react-hooks/exhaustive-deps`) agora itera
sobre `attachmentsRef.current` no unmount, capturando o array vivo em vez
do snapshot inicial vazio.

### WR-02: Avatar-vision na crítica path adiciona latência ~500-1500ms ao turn
**Files modified:** `src/app/api/coach/route.ts`
**Commit:** `188ee37`
**Applied fix:** Movido `extractContactAvatar` pra DEPOIS de `writeEvent("done", payload)`,
fire-and-forget via `.then(...).catch(() => {})`. `client` e `attachments`
viajam via closure. Persiste o `avatarUrl` em `prisma.contact.update` separado
(fora da transaction principal) — sacrifica atomicidade em troca de critical
path enxuto. Falhas continuam silenciosas (Meres confirmou no review).
Removido import não usado `ImageAttachmentPayload` (re-adicionado no WR-06).

### WR-03: Anexos do user são descartados quando POST falha
**Files modified:** `src/components/flirt-ai-shell.tsx`
**Commit:** `d0f7325`
**Applied fix:** Variante SIMPLES (conforme prompt). Mantido `setAttachments([])`
antes do fetch. No catch block, se `attachmentPayloads.length > 0`, append
o sufixo "(Anexa as imagens de novo antes de retentar.)" no `fallbackMessage`
e no `setErrorMessage`. Não restaura snapshot (UX confusa, conforme review).

### WR-04: `handleAttachChange` não respeita `MAX_ATTACHMENTS_PER_TURN`
**Files modified:** `src/components/flirt-ai-shell.tsx`
**Commit:** `56c6797`
**Applied fix:** Importado `MAX_ATTACHMENTS_PER_TURN` de `@/lib/flirt/attachments`.
No `handleAttachChange`, computado `remaining = MAX_ATTACHMENTS_PER_TURN - attachments.length`.
Early return com mensagem PT-BR ("Máximo de N imagens por turno.") se já cheio,
ou `files.slice(0, remaining)` + warn ("Só consigo aceitar mais X imagem(ns)
neste turno.") se excede. Encoding/loop só roda na slice válida.

### WR-05: AbortSignal não propagado — client cancela tab, server continua chamando Anthropic
**Files modified:** `src/app/api/coach/route.ts`, `src/lib/flirt/avatar-vision.ts`
**Commit:** `39df3ea`
**Applied fix:** `client.messages.stream(params, { signal: request.signal })`.
`extractContactAvatar` agora aceita `signal?: AbortSignal` no input e propaga
pra `client.messages.create(params, signal ? { signal } : undefined)`. Coach
route passa `signal: request.signal` na chamada background do avatar.

### WR-06: Histórico user re-injeta image blocks (só último turn)
**Files modified:** `src/app/api/coach/route.ts`
**Commit:** `ec29fba`
**Applied fix:** Re-adicionado import `type ImageAttachmentPayload`. Calculado
`lastUserHistoryIndex` (índice do último `sender === "user"` no array history
reversed). No loop `messagesForLlm`, quando `i === lastUserHistoryIndex` E
`message.attachments` é array válido, monta `content: [...imageBlocks, { type: "text", text }]`
com Type-guard runtime (filter por `type === "image"` + `typeof data === "string"`).
Demais turnos seguem como plain text — evita blow-up de tokens (a recomendação
do review era exatamente "limitar a imagens só do último turn").

## Skipped Issues

Nenhum.

## Gate de build

```
$ npm run build 2>&1 | grep -E "Compiled|Error|error|Failed"
✓ Compiled successfully in 2.7s
```

Sem erros novos. TypeScript `tsc --noEmit` rodado após cada Edit — sempre clean.

---

_Fixed: 2026-05-24T23:30:00Z_
_Fixer: code-fixer (AILA squad)_
_Iteration: 1_
