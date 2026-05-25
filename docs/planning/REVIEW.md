---
reviewed: 2026-05-25T15:15:31Z
depth: standard
wave: W7 - Diario de Campo (EncounterLog)
files_reviewed: 9
files_reviewed_list:
  - prisma/schema.prisma
  - prisma/migrations/20260525030000_create_encounter_log/migration.sql
  - src/lib/flirt/encounter-schema.ts
  - src/app/api/contacts/[id]/encounters/route.ts
  - src/components/encounter/encounter-capture-modal.tsx
  - src/components/encounter/encounter-card.tsx
  - src/components/encounter/encounter-timeline.tsx
  - src/app/desenrolos/[id]/page.tsx
  - src/types/flirt.ts
findings:
  critical: 1
  warning: 7
  info: 5
  total: 13
status: issues_found
---

# Code Review Report

**Reviewed:** 2026-05-25T15:15:31Z
**Depth:** standard
**Files Reviewed:** 9
**Wave:** W7 - Diario de Campo (EncounterLog)
**Status:** issues_found

## Summary

W7 entrega o pipeline completo (DB -> route LLM-extractor -> UI timeline + modal). A arquitetura geral esta correta: multi-tenancy aplicada na route (todos os caminhos passam por `requireUser()` + `contact.findFirst({ userId })`), Naming Lock respeitado (snake_case DB / camelCase TS / kebab-case files / PascalCase components), raw-first preservando dado do user em modo degraded, integracao W6 (`userRedPatterns` -> `UserProfile.redPatterns`) consolidada em vez de raw. Nenhuma proibicao de Tier 1 violada (sem Clerk/Supabase/AI SDK Vercel/Drizzle introduzido).

Top 3 concerns:

1. **CR-01 Race condition raw-first/extract-second** — dois POSTs concorrentes pro mesmo `Contact` corrompem `greenFlags`/`redFlags`/`attractionLevel` (read-modify-write fora da transaction, snapshot stale).
2. **WR-04 `EncounterCard` quebra silenciosamente se `extracted` faltar campo** — POST e GET serializam por caminhos diferentes (POST monta `finalExtract` direto, GET passa por `normalizeExtract`), criando risco de divergencia.
3. **WR-03 `normalizeExtract` aceita qualquer string como enum** — cast `as EncounterExtractPayload["escalation"]` sem set validation; row legacy ou typo no DB renderiza `undefined` na UI.

Os outros warnings sao validacoes de borda (cursor lookup nao re-valida ownership defensivamente, `useEffect` sem guard pra `id` undefined, `formatDate` engolindo erro, char count trimmed vs raw maxLength, re-bootstrap apos cada save). Infos sao naming/docs.

Verdict: **issues_found — blocker leve pra prod**. CR-01 deve sair antes de habilitar W7 pra mais de 1 user simultaneo (cenario realista em tab duplicada ou retry de rede). Demais WRs sao fixes de robustez na proxima wave de polish.

## Critical Issues

### CR-01: Race condition em concurrent POSTs corrompe Contact.greenFlags/redFlags/attractionLevel

**File:** `src/app/api/contacts/[id]/encounters/route.ts:55-272`

**Issue:**
O fluxo POST faz:
1. Le `contact` (linha 55-57) — snapshot do `greenFlags`/`redFlags`/`attractionLevel`.
2. `prisma.encounterLog.create` com fallback degraded (linha 117) — commit imediato.
3. Call Anthropic (latencia 3-15s tipico).
4. Faz `mergeDedupCap(contact.greenFlags, extract.greenFlags, ...)` usando a variavel do passo 1.
5. Update Contact em `$transaction` (linha 234-248) — commit final.

Se dois POSTs chegam quase simultaneamente pro mesmo `contactId` (tab duplicada, retry de rede com 502, ou usuario clicando "Salvar" 2x antes do loading state subir), ambos leem o **mesmo snapshot** do `Contact`, esperam a LLM, e o segundo a commitar **sobrescreve** o resultado do primeiro — perdendo `greenFlags`/`redFlags` que o primeiro adicionou. Pior em `attractionLevel`: se A faz `up` (Medium -> High) e B comeca com snapshot `Medium` e faz `down`, vai pra `Low` quando deveria ser `Medium` (cancelando A) ou `High` (preservando A).

O mesmo bug afeta `UserProfile.redPatterns` (linhas 251-270): `upsert` -> read -> merge local -> `update` fora de transaction unica.

`mergeDedupCap` nao protege porque opera sobre snapshot local, nao sobre o estado atual do DB.

**Fix:**
Mover read+write pro mesmo `$transaction` interativo com `Serializable`:

```ts
await prisma.$transaction(
  async (tx) => {
    const fresh = await tx.contact.findUniqueOrThrow({
      where: { id: contactId },
      select: { greenFlags: true, redFlags: true, attractionLevel: true },
    });
    const nextGreenFlags = mergeDedupCap(fresh.greenFlags, extract.greenFlags, FLAGS_CAP);
    const nextRedFlags = mergeDedupCap(fresh.redFlags, extract.redFlags, FLAGS_CAP);
    const nextAttraction = shiftAttraction(fresh.attractionLevel, extract.attractionDelta);

    await tx.encounterLog.update({
      where: { id: encounter.id },
      data: { extracted: finalExtract as unknown as Prisma.InputJsonValue },
    });
    await tx.contact.update({
      where: { id: contactId },
      data: {
        greenFlags: nextGreenFlags,
        redFlags: nextRedFlags,
        lastInteractionSummary: extract.summary,
        attractionLevel: nextAttraction,
      },
    });

    if (extract.userRedPatterns.length > 0) {
      const profile = await tx.userProfile.upsert({
        where: { userId },
        update: {},
        create: { userId },
        select: { redPatterns: true },
      });
      const current = asStringArray(profile.redPatterns);
      const merged = mergeDedupCap(current, extract.userRedPatterns, RED_PATTERNS_RAW_DB_CAP);
      if (merged.length !== current.length) {
        await tx.userProfile.update({
          where: { userId },
          data: { redPatterns: merged as unknown as Prisma.InputJsonValue },
        });
      }
    }
  },
  { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
);
```

Em Serializable, conflitos disparam erro `P2034` (write conflict) — capturar e retornar 409 com mensagem PT-BR ("Outro encontro foi salvo agora, tenta de novo") OU implementar retry com backoff (max 2x). Alternativa mais leve: advisory lock por `contactId` via `pg_advisory_xact_lock(hashtext(contactId))` na transaction.

## Warnings

### WR-01: GET cursor lookup nao re-valida ownership via nested `contact.userId`

**File:** `src/app/api/contacts/[id]/encounters/route.ts:314-318`

**Issue:**
O GET faz primeiro `prisma.contact.findFirst({ where: { id: contactId, userId } })` (linha 293-296) — 404 se nao for do user. Em seguida, no cursor lookup:

```ts
const cursorRow = await prisma.encounterLog.findFirst({
  where: { id: beforeCursor, contactId },
  select: { happenedAt: true, id: true },
});
```

Filtra por `contactId` (que sabemos ser do user). Tecnicamente seguro hoje, **mas** `EncounterLog` nao tem `userId` direto — toda query depende do guardian do `contactId`. Se um dia alguem adicionar um endpoint `/api/encounters/[id]` ou um GET sem o contact-scope inicial, regride pra cross-tenant leak. Defesa em profundidade.

**Fix:**
Usar relacao nested:

```ts
const cursorRow = await prisma.encounterLog.findFirst({
  where: { id: beforeCursor, contact: { id: contactId, userId } },
  select: { happenedAt: true, id: true },
});
```

E documentar o invariante (ver IN-05).

### WR-02: `useEffect` load nao guarda contra `id` undefined em transition de rota

**File:** `src/app/desenrolos/[id]/page.tsx:83-119, 121-146, 148-182`

**Issue:**
`useParams<{ id: string }>()` em Next 16 pode retornar `undefined` em transitions (Suspense boundary, navegacao client-side antes do params resolver). Se `id` for `undefined`, o fetch vira `/api/contacts/undefined/encounters` -> 404 silencioso. Pior: `submitEncounter` se for chamado antes do params resolver, consome quota do `usage_log` (route="encounters") sem nada acontecer.

**Fix:**
Guard inicial em todos os 3 callbacks:

```ts
useEffect(() => {
  if (!id) return;
  let cancelled = false;
  async function loadEncounters() { /* ... */ }
  void loadEncounters();
  return () => { cancelled = true; };
}, [id]);

const loadMoreEncounters = useCallback(async () => {
  if (!id) return;
  if (!encountersCursor || encountersLoadingMore) return;
  // ...
}, [id, encountersCursor, encountersLoadingMore]);

const submitEncounter = useCallback(async (payload) => {
  if (!id) throw new Error("Pagina ainda carregando.");
  // ...
}, [id, bootstrap]);
```

### WR-03: `normalizeExtract` aceita qualquer string como enum — render quebrado se DB tiver valor legacy

**File:** `src/app/api/contacts/[id]/encounters/route.ts:415-444`

**Issue:**
```ts
escalation: (obj.escalation as EncounterExtractPayload["escalation"]) ?? "indefinido",
mood: (obj.mood as EncounterExtractPayload["mood"]) ?? "neutro",
attractionDelta: (obj.attractionDelta as EncounterExtractPayload["attractionDelta"]) ?? "same",
```

O cast `as ...` aceita qualquer string em runtime. Se uma row antiga ou typo no LLM output tiver `escalation: "ascendente"`, `mood: "feliz"`, `attractionDelta: "rise"`, o frontend recebe enum invalido. Em `encounter-card.tsx:92`, `ESCALATION_LABEL[extracted.escalation]` retorna `undefined` -> chip vazio. `escalationStyle()` cai no `else` (border-white/15) mas ainda renderiza icone errado.

**Fix:**
Validar via Set inline:

```ts
const ESCALATION_SET = new Set<string>(["regrediu", "estagnou", "avancou", "indefinido"]);
const MOOD_SET = new Set<string>(["leve", "tenso", "intenso", "frustrante", "neutro"]);
const DELTA_SET = new Set<string>(["down", "same", "up"]);

function safeEnum<T extends string>(value: unknown, set: Set<string>, fallback: T): T {
  return typeof value === "string" && set.has(value) ? (value as T) : fallback;
}

return {
  summary: typeof obj.summary === "string" ? obj.summary : "",
  escalation: safeEnum(obj.escalation, ESCALATION_SET, "indefinido"),
  mood: safeEnum(obj.mood, MOOD_SET, "neutro"),
  nextMove: typeof obj.nextMove === "string" ? obj.nextMove : "",
  attractionDelta: safeEnum(obj.attractionDelta, DELTA_SET, "same"),
  greenFlags: asStringArray(get("greenFlags", []) as Prisma.JsonValue),
  redFlags: asStringArray(get("redFlags", []) as Prisma.JsonValue),
  userRedPatterns: asStringArray(get("userRedPatterns", []) as Prisma.JsonValue),
  ...(obj.degraded === true ? { degraded: true } : {}),
};
```

### WR-04: `EncounterCard` assume `extracted` completo — POST e GET serializam por caminhos diferentes

**File:** `src/components/encounter/encounter-card.tsx:73-178`, `src/app/api/contacts/[id]/encounters/route.ts:223-232, 337-339`

**Issue:**
- GET roda `normalizeExtract(row.extracted)` -> shape garantido (com defaults pros 8 campos).
- POST monta `finalExtract` direto do `extract` validado pelo Zod (linha 223-232). Tambem garantido pelo Zod.
- Fallback degraded (linha 105-115) tambem garantido pelo tipo literal.

Hoje OK, mas se alguem mudar o flow pra retornar `extracted: row.extracted` raw em algum endpoint novo, `extracted.greenFlags.length` (linha 117 do card) throw `Cannot read properties of undefined`. Sem `<ErrorBoundary>` na page, a timeline inteira quebra.

**Fix:**
Centralizar **toda** serializacao de `EncounterRecord.extracted` por uma funcao unica que retorna `EncounterExtractPayload` validado. Hoje existem dois caminhos (`normalizeExtract` no GET, montagem inline no POST) — unificar:

```ts
function toEncounterPayload(input: unknown, fallback?: EncounterExtractPayload): EncounterExtractPayload {
  // normaliza + valida enums via safeEnum (WR-03) + retorna shape garantido
}

// POST:
encounter: serializeEncounter(encounter, toEncounterPayload(finalExtract))
// GET:
slice.map((row) => serializeEncounter(row, toEncounterPayload(row.extracted)))
```

Defensivo extra no componente:

```ts
const greens = extracted.greenFlags ?? [];
const reds = extracted.redFlags ?? [];
const userPatterns = extracted.userRedPatterns ?? [];
```

### WR-05: `formatDate` cai pra string "Data Inválida" em vez do ISO original

**File:** `src/components/encounter/encounter-card.tsx:56-69`

**Issue:**
```ts
function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    return new Intl.DateTimeFormat("pt-BR", { ... }).format(date);
  } catch {
    return iso;
  }
}
```

`new Date("garbage")` retorna `Invalid Date` (nao throw). `Intl.DateTimeFormat.format(invalidDate)` retorna `"Data Inválida"` (em pt-BR). O catch nunca dispara. O fallback `return iso` morre. Usuario ve `"Data Inválida"` em vez do ISO original (que seria pelo menos debugavel).

**Fix:**
```ts
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
```

### WR-06: Char count usa trimmed mas `maxLength` HTML usa raw — UX inconsistente

**File:** `src/components/encounter/encounter-capture-modal.tsx:110-166, 154, 194`

**Issue:**
```ts
const charCount = rawText.trim().length;        // linha 110 — trimmed
maxLength={MAX_CHARS}                            // linha 154 — raw
disabled={submitting || charCount < MIN_CHARS}   // linha 194 — trimmed
```

Backend valida `z.string().trim().min(5).max(MAX_RAW_TEXT)` (linha 40). Se o user cola texto de 4001 chars com whitespace, o browser bloqueia em 4000 raw — mas o display mostra "X/4000" usando trimmed count (ate 3999 visivel). Discrepancia confusa. Mais grave: se cola exatamente 4000 chars onde 100 sao whitespace nas pontas, backend trim leva pra 3900 - aceita; mas display mostra 3900/4000 (assumindo trim) enquanto o user ve 4000 chars no campo - confunde.

**Fix:**
Padronizar pra **raw** no display + manter validacao trimmed pro submit:

```ts
const rawLen = rawText.length;
const trimmedLen = rawText.trim().length;
const tooShort = trimmedLen > 0 && trimmedLen < MIN_CHARS;

// Display:
<span>{rawLen}/{MAX_CHARS} caracteres</span>

// Submit guard mantem trimmed:
disabled={submitting || trimmedLen < MIN_CHARS}
```

### WR-07: `bootstrap()` apos cada submit refaz lista inteira de contatos

**File:** `src/app/desenrolos/[id]/page.tsx:174`

**Issue:**
```ts
// Refresca o contato no Zustand pra refletir greenFlags/redFlags/lastInteractionSummary/attractionLevel.
void bootstrap();
```

`bootstrap()` chama `GET /api/contacts` que retorna **todos** os contatos do user. Apos cada encontro:
1. Network round-trip extra (~50-200ms).
2. Reescreve `contacts` no Zustand -> dispara re-render na sidebar global.
3. Reference equality quebrada -> filhos que dependem de `contacts.find(...)` re-renderizam.

A route POST ja retorna `contact: serializeContact(refreshedContact)` no body (linha 281). Basta consumir.

**Fix:**
Adicionar action `applyContactPatch(id, patch)` no `use-flirt-store.ts` (se nao existir) e:

```ts
const submitEncounter = useCallback(async (payload) => {
  // ... fetch ...
  setEncounters((prev) => [data.encounter as EncounterRecord, ...prev.filter((e) => e.id !== data.encounter!.id)]);

  if (data.contact) {
    useFlirtStore.getState().applyContactPatch(id, data.contact);
  }

  return { encounter: data.encounter, degraded: data.degraded === true, degradedReason: data.degradedReason };
}, [id]);
```

Se nao quiser adicionar action agora (out of scope), substituir por `updateContact(id, partial)` que ja deve existir no store.

## Info

### IN-01: Enums sem acento (`avancou`) — documentar decisao

**File:** `src/lib/flirt/encounter-schema.ts:11-26`, `src/components/encounter/encounter-card.tsx:19-32`

**Issue:**
DB/enum: `avancou`, `regrediu`, `estagnou`, `indefinido` (sem acentos). UI label: `Avançou` (com acento). Decisao razoavel (Anthropic tool `input_schema.enum` nao garante unicode normalization), mas nao documentada. Risco: futura migracao ou desenvolvedor novo escreve `"avançou"` em algum fix e Zod rejeita silenciosamente.

**Fix:** comentario no schema:
```ts
// Enums em snake_case SEM ACENTO — Anthropic tool input_schema enums
// nao garantem unicode normalization; LLM as vezes devolve com acento.
// Frontend traduz pra labels com acento via ESCALATION_LABEL/MOOD_LABEL.
export const ESCALATION_VALUES = ["regrediu", "estagnou", "avancou", "indefinido"] as const;
```

E adicionar nota em `DATA-MODEL.md` secao EncounterLog (no shape de `extracted`).

### IN-02: Imports duplicados de `@prisma/client`

**File:** `src/app/api/contacts/[id]/encounters/route.ts:4, 22-24`

**Issue:**
```ts
import { Prisma } from "@prisma/client";
// ...
import type {
  AttractionLevel as PrismaAttractionLevel,
} from "@prisma/client";
```

Dois imports separados do mesmo modulo.

**Fix:**
```ts
import { Prisma, type AttractionLevel as PrismaAttractionLevel } from "@prisma/client";
```

### IN-03: Confirmar `EncounterRecord` como source de truth no boundary

**File:** `src/components/encounter/encounter-capture-modal.tsx:12-23`, `src/app/desenrolos/[id]/page.tsx:148-182`

**Issue:**
`SubmitResult` no modal e o shape de retorno em `submitEncounter` estao alinhados hoje. Se a API mudar (ex: response wrapping em `{ data: { encounter, ... } }`), os types compilam mas runtime quebra.

**Fix (opcional, defensivo):**
Adicionar Zod parser no client pra validar response:

```ts
const ENCOUNTER_POST_SHAPE = z.object({
  encounter: z.object({ /* shape de EncounterRecord */ }),
  contact: z.object({ id: z.string() }).optional(),
  degraded: z.boolean().optional(),
  degradedReason: z.string().optional(),
});
```

Out of scope pro W7, mas vale considerar em W8.

### IN-04: Cursor pode ficar stale apos varios submits — improvavel mas vale anotar

**File:** `src/app/desenrolos/[id]/page.tsx:168-172`

**Issue:**
Apos `submitEncounter` o codigo prepende encounter no array sem alterar `encountersCursor`. Funcional porque cursor aponta pra `happenedAt DESC` mais antigo do primeiro fetch, e novos encounters tem `happenedAt` mais recente (entram **antes** do cursor). Edge case: se user registra encounter com `happenedAt` no passado (data manual), pode pular item ao "Carregar mais".

**Fix:** Sem fix necessario no W7 — anotar pra revisar se aparecer bug "encontro sumiu da timeline".

### IN-05: Documentar invariante de seguranca de `EncounterLog` no DATA-MODEL.md e schema.prisma

**File:** `prisma/schema.prisma:197-209`, `docs/DATA-MODEL.md` secao EncounterLog

**Issue:**
`EncounterLog` nao tem `userId`. Multi-tenancy depende do FK `contactId` + ownership check de `contact.userId`. Se nao documentado, regressao futura facil.

**Fix:**
Adicionar bloco em `DATA-MODEL.md`:

```markdown
> **SECURITY:** `encounter_log` nao tem `user_id` direto. Multi-tenancy
> e enforced via `contact_id` FK. Toda query MUST filtrar por
> `{ contactId } + ownership de contact via { contact: { userId } }`.
> Helper recomendado: `prisma.encounterLog.findMany({ where: { contact: { userId } } })`.
> Padrao seguro: nunca expor endpoint `/api/encounters/[id]` sem nesting.
```

E comentario no schema:

```prisma
// SECURITY: EncounterLog nao tem userId direto. Toda query DEVE filtrar
// por contactId E re-validar contact.userId === requireUser().
// Use { where: { contact: { userId } } } pra defesa em profundidade.
model EncounterLog {
  ...
}
```

---

_Reviewed: 2026-05-25T15:15:31Z_
_Reviewer: code-reviewer (AILA squad)_
_Depth: standard_
_Final tally: **CR=1 · WR=7 · IN=5 · total=13**_
_Verdict: **issues_found — blocker leve pra deploy publico**. CR-01 deve ser resolvido antes de habilitar W7 pra mais de 1 user simultaneo (tab duplicada ou retry de rede ja reproduzem). Demais WRs sao fixes de robustez recomendados na proxima wave de polish. INs sao docs/style._
