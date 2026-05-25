---
reviewed: 2026-05-25T01:29:28Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - prisma/schema.prisma
  - prisma/migrations/20260525011534_add_user_preferences/migration.sql
  - src/app/api/settings/route.ts
  - src/app/settings/page.tsx
  - src/lib/flirt/system-prompt.ts
  - src/app/api/coach/route.ts
  - src/app/api/contacts/route.ts
  - src/app/desenrolos/page.tsx
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Code Review Report

**Reviewed:** 2026-05-25T01:29:28Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Wave 5 (Settings + Search server-side + CoachTone) entrega o que o HANDOFF promete. Schema, migration, settings API, settings UI, system-prompt e coach route conversam de forma consistente — Naming Lock respeitado (snake_case ↔ camelCase ↔ kebab-case ↔ PascalCase), Schema-First com DATA-MODEL referenciado no schema, e nenhuma proibição Tier 1 violada (continua NestJS-livre puro Next 16 + Prisma 7 + better-auth + Coolify).

Achados estão concentrados em 2 frentes:

1. **Cache control da Anthropic com system prompt dinâmico** — `coach/route.ts:206-211` marca o system com `cache_control: ephemeral`, mas agora o conteúdo varia por `coachTone` por user. Cache hit só vai existir entre turns do MESMO user com o MESMO tom. Não é bug — é o trade-off correto pra W5 — mas o HANDOFF lista "verificar Langfuse que cache hit acontece" como pendente; o valor esperado de hit-rate caiu (e o gate W5 não cobre isso explicitamente).
2. **`GET /api/contacts` retorna `messages` sem `take` nem `select`** — combinado com `CONTACTS_LIST_LIMIT=500`, payload pode crescer pra dezenas de MB num user com histórico longo, especialmente agora que search server-side pode rotacionar 500 contatos por keystroke debouncado. Pré-existe ao W5 mas o impacto cresce com a busca nova.

Sem Critical. 4 Warning (performance/correctness com escala), 6 Info (manutenibilidade + pequenos polimentos). Build pode mergear; recomendado abrir issue de débito pra WR-01/WR-02 antes da próxima wave.

## Warnings

### WR-01: GET /api/contacts retorna todas as mensagens de cada contato sem `take` (payload explode em escala)

**File:** `src/app/api/contacts/route.ts:67-80`
**Issue:** Com `CONTACTS_LIST_LIMIT = 500` e `include: { messages: { orderBy: { createdAt: "asc" } } }` sem `take` nem `select`, cada listagem pode trazer milhares de mensagens. Em `/desenrolos`, isso roda a cada keystroke (debouncado a 250ms) — um user com 50 contatos × 200 mensagens já gera ~25-50MB de JSON por request. Worsens W5 search UX (latência alta cancela o ganho do server-side filter).

A listagem da UI (`DesenroloCard`) só usa `name`, `tags`, `location`, `metContext`, `status`, `attractionLevel`, `padrao`, `avatar` — ou seja, NÃO precisa de `conversationHistory` aqui.

**Fix:** Aceitar um query param opt-in pra incluir mensagens, ou aplicar `take` + projeção quando a rota for usada pra listagem.

```ts
// Em GET, derivar do query param:
const includeMessages = searchParams.get("include") === "messages";

const contacts = await prisma.contact.findMany({
  where: {
    userId,
    ...(kindFilter ? { kind: kindFilter as ContactKind } : {}),
    ...(searchFilter ?? {}),
  },
  orderBy: { updatedAt: "desc" },
  take: CONTACTS_LIST_LIMIT,
  include: includeMessages
    ? { messages: { orderBy: { createdAt: "asc" }, take: 50 } }
    : undefined,
});
```

E ajustar `serializeContact` pra tolerar `messages: undefined` (provavelmente já tolera; conferir). `desenrolos/page.tsx` chama sem `include=messages`, então fica leve.

---

### WR-02: System prompt agora varia por `coachTone` mas mantém `cache_control: ephemeral` — cache hit muda de "global por mode" pra "por (user, tone)"

**File:** `src/app/api/coach/route.ts:206-211`
**Issue:** Antes do W5, `buildSystemPrompt(mode)` produzia 1 de 2 prompts possíveis (incoming/strategy) — qualquer call no mesmo mode caía no mesmo cache key. Agora, com `tone?: CoachToneId | null`, o prompt tem 8 variantes possíveis (`2 modes × 4 tones (incluindo null)`). Ainda OK pra cache, mas o miss-rate sobe e o HANDOFF (W5 Critério 6) pede confirmação Langfuse que ainda não rolou.

Risco real: se Wave 6 (UserProfile) injetar mais campos dinâmicos no system (timezone do user, nome dele, etc), o cache vai degradar pra ~0% sem ninguém perceber até a fatura da Anthropic chegar.

**Fix:** Separar o que é estável (CORE + mode addendum + structured guide) do que varia (tone) em 2 blocos de system, e só aplicar `cache_control` no bloco estável:

```ts
const baseSystem = [
  FLIRT_AI_SYSTEM_PROMPT_CORE,
  mode === "strategy" ? FLIRT_AI_MODE_STRATEGY : FLIRT_AI_MODE_INCOMING,
  FLIRT_AI_STRUCTURED_RESPONSE_GUIDE,
].join("\n\n");

const toneAddendum = user?.coachTone ? COACH_TONE_ADDENDA[user.coachTone] : null;

const systemBlocks: Anthropic.TextBlockParam[] = [
  { type: "text", text: baseSystem, cache_control: { type: "ephemeral" } },
];
if (toneAddendum) {
  systemBlocks.push({ type: "text", text: toneAddendum });
}

stream = client.messages.stream({
  model,
  max_tokens: 2048,
  system: systemBlocks,
  // ...
});
```

Isso preserva cache hit em ~95% do prompt e custa pouca complexidade. Requer mover a montagem do prompt pra cá ou expor `buildSystemPromptParts()` em `system-prompt.ts`.

---

### WR-03: `locale` aceito pelo Zod não bate com o set fechado oferecido na UI — drift silencioso entre back e front

**File:** `src/app/api/settings/route.ts:25-28` + `src/app/settings/page.tsx:61-65`
**Issue:** `localeSchema` aceita qualquer string que case com `/^[a-z]{2}(-[A-Z]{2})?$/` (centenas de combinações), mas a UI só oferece `pt-BR | en-US | es-ES`. Um cliente API custom (ou um user que abrir DevTools) pode persistir `fr-FR`, `ko-KR`, etc. — depois a UI volta com `<select value="fr-FR">` e renderiza vazio porque `fr-FR` não está em `LOCALE_OPTIONS`. Mesma análise pra timezone (regex aceita ~600 zonas IANA, UI lista 11).

Não é crítico hoje (não há nada consumindo `locale` em runtime ainda), mas vira bug quando W6 começar a formatar datas. O HANDOFF reconhece "Afetam formatação de datas e a UI no futuro" — agora é o momento de fechar o set.

**Fix:** Apertar o schema pro mesmo enum literal da UI, OU exportar constantes compartilhadas:

```ts
// src/lib/flirt/locale-options.ts (novo)
export const LOCALE_IDS = ["pt-BR", "en-US", "es-ES"] as const;
export type LocaleId = (typeof LOCALE_IDS)[number];

export const TIMEZONE_IDS = [
  "America/Sao_Paulo",
  "America/Manaus",
  // ... resto
] as const;
export type TimezoneId = (typeof TIMEZONE_IDS)[number];

// Em settings/route.ts:
const localeSchema = z.enum(LOCALE_IDS);
const timezoneSchema = z.enum(TIMEZONE_IDS);

// Em settings/page.tsx: importar a constante e usar o mesmo array no <select>.
```

Bonus: type-safety end-to-end. O regex IANA atual também rejeita zonas válidas tipo `Etc/GMT+3` (`+` não casa o regex) e algumas com 3 segmentos tipo `America/Argentina/Buenos_Aires` casa, mas o `<select>` da UI nem oferece — então a defesa em profundidade hoje é mais flexível que o produto.

---

### WR-04: `handleSaveCoachTone` ignora erro de rede e deixa UI fora de sync com o servidor

**File:** `src/app/settings/page.tsx:177-180`
**Issue:** O setter `setCoachTone(tone ?? "")` roda ANTES do `await save(...)`. Se a PATCH falhar (rede caiu, 401, 500), `save()` captura o erro em `setError(...)` mas o radio button permanece marcado no novo valor — o user vê "Tom 'Provocador' aplicado" no estado visual mas o servidor continua com o valor antigo. Reload da página corrige, mas a experiência mente.

Padrão similar de outros forms (`handleSaveAccount`) é safe porque o `<select>` é controlled pelos refs que só commitam no submit — mas no radio, o setter é otimista e nada reverte.

**Fix:** Capturar o valor anterior e reverter no catch:

```ts
async function handleSaveCoachTone(tone: CoachToneId | null) {
  const previous = coachTone;
  setCoachTone(tone ?? "");
  try {
    await save(
      { coachTone: tone },
      tone ? `Tom "${tone}" aplicado.` : "Tom default restaurado.",
    );
  } catch {
    // save() já setou error; reverte UI pro estado consistente
    setCoachTone(previous);
  }
}
```

Como `save()` engole o erro internamente (não re-throw), o `catch` aqui nunca dispara. Refator alternativo: ter `save()` retornando `{ ok: boolean }` ou propagar throw.

```ts
async function save(...): Promise<boolean> {
  // ...
  try {
    // ...
    setSuccess(successMessage);
    return true;
  } catch (cause) {
    setError(cause instanceof Error ? cause.message : "Erro ao salvar.");
    return false;
  } finally {
    setSaving(false);
  }
}

// Caller:
async function handleSaveCoachTone(tone: CoachToneId | null) {
  const previous = coachTone;
  setCoachTone(tone ?? "");
  const ok = await save({ coachTone: tone }, ...);
  if (!ok) setCoachTone(previous);
}
```

## Info

### IN-01: Migration timestamp `20260525011534` está 1 dia à frente da data registrada no HANDOFF (24-05-2026)

**File:** `prisma/migrations/20260525011534_add_user_preferences/migration.sql`
**Issue:** HANDOFF documenta `data: 24-05-2026` mas o timestamp da migration é `2026-05-25 01:15:34` (UTC). Provavelmente artifact de fuso horário (UTC vs America/Sao_Paulo) ou de `prisma migrate dev` rodando depois da meia-noite UTC. Não causa bug, mas confunde auditoria.
**Fix:** Sem ação requerida — só mencionar em DATA-MODEL.md (seção "Migration history") que timestamps são UTC.

---

### IN-02: `desenrolos/page.tsx` re-filtra `serverResults` por `c.kind === "desenrolo"` redundantemente

**File:** `src/app/desenrolos/page.tsx:119-120`
**Issue:** O fetch já manda `kind: "desenrolo"` em `params` (linha 79), então a resposta do servidor já é só de desenrolos. O `.filter()` é defensivo mas custa O(n) e mascara qualquer drift futuro entre front e back.
**Fix:**
```ts
const desenrolos = useMemo(() => {
  if (hasActiveSearch && serverResults) {
    return serverResults; // server já filtrou por kind=desenrolo
  }
  return contacts.filter((c) => c.kind === "desenrolo");
}, [contacts, hasActiveSearch, serverResults]);
```

---

### IN-03: `searchError` pode persistir entre buscas — não é limpo quando query volta abaixo do mínimo

**File:** `src/app/desenrolos/page.tsx:62-70`
**Issue:** Se uma busca falha (network drop) e o user apaga até voltar pra <2 chars, o `searchError` vermelho continua renderizado porque o branch early-return na linha 70 só limpa o controller, não o erro. O banner some só na próxima busca com sucesso.
**Fix:** Limpar erro no early-return:
```ts
if (trimmed.length < SEARCH_MIN_CHARS) {
  abortRef.current?.abort();
  abortRef.current = null;
  setSearchError(null);
  return;
}
```
(Atenção ao react-hooks/set-state-in-effect — pode precisar guarding com `if (searchError !== null)`.)

---

### IN-04: `User.timezone`/`locale`/`notificationPrefs` não têm `defaults` server-side no schema — depende de cada caller injetar o default

**File:** `prisma/schema.prisma:32-35`
**Issue:** As 3 colunas são nullable sem `@default`. Hoje a UI cuida disso (cai pro `defaults.timezone` do payload GET), e `/api/coach` só lê `coachTone` (que é genuinamente "default = null" no enum). Mas qualquer novo consumer server-side de `user.timezone` vai precisar lembrar de aplicar o fallback `"America/Sao_Paulo"`. Risco de drift.
**Fix:** Centralizar fallback num helper:
```ts
// src/lib/user-preferences.ts
export const PREFERENCE_DEFAULTS = {
  timezone: "America/Sao_Paulo",
  locale: "pt-BR",
  notificationPrefs: { push: false, frequency: "daily" as const },
};

export function resolveTimezone(user: { timezone: string | null }) {
  return user.timezone ?? PREFERENCE_DEFAULTS.timezone;
}
```
E reusar nos consumers (e no `/api/settings` GET, removendo o duplicado em `route.ts:48-50`).

---

### IN-05: Comentário "(generator client) sem `output`" implícito — Prisma 7 driver adapter exige `output` em alguns setups

**File:** `prisma/schema.prisma:1-3`
**Issue:** Generator client não declara `output`. Funciona porque o projeto usa o default `node_modules/.prisma/client`, mas o resto da stack está com Prisma 7 + driver adapter — preferível ser explícito. (Não é bug; só ruído pra agente externo que vai mexer aqui.)
**Fix:** Documentar no CLAUDE.md (já feito — linha 27 menciona `@prisma/adapter-pg`) ou adicionar comentário no `schema.prisma` apontando pra `src/lib/db.ts`.

---

### IN-06: 4 pontos de manutenção pra `CoachTone` (já anotado no HANDOFF guard-rails, mas vale ficha de débito)

**File:** `src/lib/flirt/system-prompt.ts:74-95` + `src/app/settings/page.tsx:67-87` + `prisma/schema.prisma:123-127` + qualquer doc copy
**Issue:** Adicionar um novo tom exige migration + `COACH_TONE_ADDENDA` + `COACH_TONE_OPTIONS` + `CoachToneId` literal. Drift entre os 4 vai compilar (TS aceita `Record<CoachToneId, string>` desde que cubra os literais do `CoachToneId`, mas se schema mudar e o type não, runtime quebra no `enum CoachTone`).
**Fix:** Importar o enum do Prisma uma vez e derivar tudo:
```ts
// system-prompt.ts
import { CoachTone } from "@prisma/client";
export type CoachToneId = `${CoachTone}`;
const COACH_TONE_ADDENDA: Record<CoachToneId, string> = { /* ... */ };

// settings/page.tsx
import { CoachTone } from "@prisma/client";
type CoachToneId = `${CoachTone}`;
const COACH_TONE_OPTIONS: ReadonlyArray<{ id: CoachToneId; label: string; description: string }> = [
  /* ... */
];
```
Single source of truth = enum no `schema.prisma`. Reduz pra 2 pontos (schema + 2 arquivos que importam o enum).

---

_Reviewed: 2026-05-25T01:29:28Z_
_Reviewer: code-reviewer (AILA squad)_
_Depth: standard_
