---
fixed_at: 2026-05-25T03:30:00Z
review_path: docs/planning/REVIEW.md
iteration: 2
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Code Review Fix Report

**Fixed at:** 2026-05-25T03:30:00Z
**Source review:** docs/planning/REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope: 7 (CR-01, WR-01..WR-06 — IN-01..IN-05 fora do escopo `critical_warning`)
- Fixed: 7
- Skipped: 0
- Base commit: `6a89046`
- Head commit: `0b1c2f7`

## Fixed Issues

### CR-01: Feedback de sugestao sempre 404 — messageId do servidor descartado no client
**Files modified:** `src/store/use-flirt-store.ts`
**Commit:** `436a8b6`
**Applied fix:** `applyCoachResponse` agora exige `CoachChatResponse & { messageId: string }` no parametro e usa `response.messageId` direto como `id` da `ConversationMessage` (em vez de `crypto.randomUUID()` que ignorava o cuid do banco). Tipo da action atualizado. O caller no shell (linha 613) ja passava o `donePayload` completo com `messageId` — so faltava o store consumir. POST de `/api/me/profile/feedback` agora encontra a Message no banco em vez de 404.

### WR-01: appendCapped dedup desloca recente + conflito cross-array
**Files modified:** `src/app/api/me/profile/feedback/route.ts`
**Commit:** `5f673f2`
**Applied fix:** Dois fixes na mesma rota. (1) `appendCapped` trocou `filter+push` por checagem previa `Array.includes` — se item ja existe, retorna array como estava sem promover pra recencia. (2) Antes do update, remove `suggestionText` do array oposto: clicar `worked` limpa de `redPatternsRaw`, clicar `didnt_work` limpa de `winSamples`. Evita sinal contraditorio chegando no `me-context` ("ja funcionou" + "evite repetir" pro mesmo texto).

### WR-02: SuggestionFeedback permite trocar rating apos sucesso + race
**Files modified:** `src/components/suggestion-feedback.tsx`
**Commit:** `e4aa9fc`
**Applied fix:** Guard em `send()` agora ignora chamadas quando `status === "sending" || status === "sent"` (antes so checava `sending`). Botoes ficam `disabled` apos `sent`. Acao virou irreversivel por turno, coerente com a UX "thumbs simples" do W6 — mudanca de ideia precisa de UI explicita (DELETE endpoint futuro). Elimina race de 3 POSTs paralelos com closure desatualizado.

### WR-03: fetches client sem AbortSignal
**Files modified:** `src/components/me-banner-cta.tsx`, `src/components/me-onboarding-modal.tsx`, `src/app/me/page.tsx`, `src/components/suggestion-feedback.tsx`
**Commit:** `07e056f`
**Applied fix:** Trocada flag `cancelled` por `AbortController` real em 3 useEffects e adicionado controller ref-based em `<SuggestionFeedback>` (componente persiste mas precisa abortar POST se desmontar durante fetch). Cleanup do useEffect chama `ac.abort()`. `AbortError` silenciado em todos os catches. Resolve double-fetch em StrictMode dev + vazamento de conexao em unmount + caso onde modal podia reabrir apos dismiss em route transition.

### WR-04: Banner CTA + Modal duplicavam fetch a /api/me/profile
**Files modified:** `src/lib/use-me-profile.ts` (novo), `src/components/me-banner-cta.tsx`, `src/components/me-onboarding-modal.tsx`
**Commit:** `447df1e`
**Applied fix:** Criado hook `useMeProfile()` em `src/lib/use-me-profile.ts` com cache em modulo (compartilhado entre consumers do mesmo tab) + listeners pra propagar updates entre rerenders + `refetch()` pra invalidar apos onboarding submit. `MeBannerCta` e `MeOnboardingModal` agora consomem do mesmo hook — 1 request por load do shell em vez de 2 simultaneas (3+ com `/me` visitada). Reaproveitavel pra qualquer futuro consumer.

### WR-05: Caps duplicados em 3 arquivos
**Files modified:** `src/lib/flirt/me-limits.ts` (novo), `src/app/api/me/profile/feedback/route.ts`, `src/lib/flirt/me-context.ts`, `src/app/me/page.tsx`
**Commit:** `78b2cc5`
**Applied fix:** Criado `src/lib/flirt/me-limits.ts` exportando `WIN_SAMPLES_DB_CAP=100`, `RED_PATTERNS_RAW_DB_CAP=200`, `ME_CONTEXT_RENDER_CAP=12`, `ME_PAGE_DISPLAY_CAP=20`. Os 3 sites consumidores importam as constantes em vez de hardcodar. Render cap em `me-context.ts` mantido com alias local pra legibilidade (`const RENDER_CAP = ME_CONTEXT_RENDER_CAP`). Comportamento atual identico — fix e preparatorio pra W8 (consolidador) nao desalinhar storage layer.

### WR-06: PATCH /api/me/profile aceita body vazio silenciosamente
**Files modified:** `src/app/api/me/profile/route.ts`
**Commit:** `0b1c2f7`
**Applied fix:** Apos montar `data: Prisma.UserProfileUpdateInput`, valida `Object.keys(data).length === 0` -> responde 400 com `"Envie ao menos um campo pra atualizar."`. Antes o prisma `upsert` fazia update com `{}` (noop) e respondia 200 mentindo. Nielsen H5 (prevencao): API deve sinalizar erro do front (form sem dirty check) em vez de mascarar. Comentario inline adicionado explicitando semantica `undefined = nao toca; null = nullify`.

## Skipped Issues

_None._

## Verification

- **Tier 1 (re-read):** Todos os 7 fixes re-validados visualmente apos Edit.
- **Tier 2 (`npx tsc --noEmit`):** Baseline clean antes dos fixes (0 erros). Cada commit individual ficou clean — nenhuma regressao de tipo introduzida pelos fixes.
- **Rollback:** nao foi necessario em nenhum fix.

## Out of scope (nao tocado)

5 findings Info (IN-01 a IN-05) ficaram intocados conforme `fix_scope: critical_warning`:

- **IN-01** — duplicacao de `CONTEXT_LIFE_OPTIONS` / `RELATIONSHIP_OPTIONS` entre `lib/flirt/me-onboarding.ts` e as 2 routes.
- **IN-02** — comentario desatualizado em `me-context.ts:5-6` (parcialmente cuidado em WR-05 quando o comentario foi reescrito; restante e polish).
- **IN-03** — TODO de LGPD/W8 consolidador em `me/profile/route.ts` DELETE.
- **IN-04** — rename de `materializeCreate` pra `nonNullableCreateFields`.
- **IN-05** — magic strings de rate-limit keys (`"me-feedback"`, `"coach"`) viram constantes.

Podem virar proxima rodada se Meres pedir `fix_scope: all`.

---
_Fixed: 2026-05-25T03:30:00Z_
_Fixer: code-fixer (AILA squad)_
_Iteration: 2_
