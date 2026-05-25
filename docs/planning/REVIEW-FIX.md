---
fixed_at: 2026-05-25T02:15:00Z
review_path: docs/planning/REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Code Review Fix Report

**Fixed at:** 2026-05-25T02:15:00Z
**Source review:** docs/planning/REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (WR-01, WR-02, WR-03, WR-04 — IN-* fora do escopo `critical_warning`)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: GET /api/contacts retorna todas as mensagens de cada contato sem `take`
**Files modified:** `src/app/api/contacts/route.ts`, `src/store/use-flirt-store.ts`
**Commit:** `6ec7c1e`
**Applied fix:** Mensagens viraram opt-in via `?include=messages`. Quando incluso, aplica `take: MESSAGES_INCLUDE_TAKE = 50` (cap). O `bootstrap()` do Zustand passa `include=messages` pra preservar o shell monolítico que renderiza `conversationHistory` direto do cache; o `/desenrolos` continua chamando sem o param e recebe payload enxuto. `serializeContact` já tolerava `messages: undefined` (linha 79 — `contact.messages?.map(...) ?? []`).

### WR-02: System prompt com `cache_control` mas conteúdo varia por user (coachTone)
**Files modified:** `src/lib/flirt/system-prompt.ts`, `src/app/api/coach/route.ts`
**Commit:** `ea98505`
**Applied fix:** Exposto `buildSystemPromptParts(mode, tone)` retornando `{ base, toneAddendum }`. O coach route monta 2 blocos system: `base` (core + mode + structured guide) com `cache_control: ephemeral`, e o `toneAddendum` (quando existe) como bloco sem cache. Preserva cache hit em ~95% do prompt mesmo com tone variando. `buildSystemPrompt()` virou wrapper fino do `buildSystemPromptParts()` pra preservar compat com qualquer caller futuro.

### WR-03: `locale`/`timezone` Zod aceita mais que a UI oferece (drift silencioso)
**Files modified:** `src/lib/flirt/locale-options.ts` (novo), `src/app/api/settings/route.ts`, `src/app/settings/page.tsx`
**Commit:** `d23d096`
**Applied fix:** Criado `src/lib/flirt/locale-options.ts` com `LOCALE_IDS` + `TIMEZONE_IDS` `as const`. Zod no `/api/settings` agora usa `z.enum(LOCALE_IDS)` / `z.enum(TIMEZONE_IDS)` em vez de regex frouxo. UI deriva opções com labels via `Record<TimezoneId|LocaleId, string>` — adicionar novo ID força label no compile time. Fecha drift back↔front: nenhum caller consegue persistir valor que o `<select>` não renderiza.

### WR-04: `handleSaveCoachTone` ignora erro de rede (UI fora de sync)
**Files modified:** `src/app/settings/page.tsx`
**Commit:** `7a36ead`
**Applied fix:** `save()` agora retorna `Promise<boolean>` (true em sucesso, false em erro — error message ainda setado via `setError`). `handleSaveCoachTone` captura `previous = coachTone`, faz update otimista, e reverte `setCoachTone(previous)` se `save()` retornar false. Outros forms (perfil, conta, key, notificações) ignoram o retorno — são controlled by refs/inputs que só commitam no submit, não precisam reverter.

## Skipped Issues

_None._

## Verification

- Cada fix passou por **Tier 1** (re-read do trecho editado) + **Tier 2** (`npx tsc --noEmit` sem erros novos).
- Baseline TS rodada antes dos fixes (clean, 0 erros). Cada commit subsequente também ficou clean.
- Nenhum rollback foi necessário.

## Out of scope (não tocado)

6 findings Info (IN-01 a IN-06) ficaram intocados conforme `fix_scope: critical_warning`. São polimentos de manutenibilidade (timezone migration UTC, filter redundante em desenrolos, searchError não-limpo, defaults server-side, generator output, derivar CoachTone do Prisma enum). Podem virar próxima rodada se Meres quiser.

---
_Fixed: 2026-05-25T02:15:00Z_
_Fixer: code-fixer (AILA squad)_
_Iteration: 1_
