---
fixed_at: 2026-05-25T16:00:00Z
review_path: docs/planning/REVIEW.md
iteration: 1
wave: W7 - Diario de Campo (EncounterLog)
findings_in_scope: 13
fixed: 11
skipped: 2
status: partial
---

# Code Review Fix Report

**Fixed at:** 2026-05-25T16:00:00Z
**Source review:** docs/planning/REVIEW.md
**Iteration:** 1
**Wave:** W7 - Diario de Campo (EncounterLog)

**Summary:**
- Findings in scope: 13 (1 Critical + 7 Warning + 5 Info)
- Fixed: 11
- Skipped: 2 (IN-03 e IN-04 — review explicitamente marca como out-of-scope/no-fix)

Verification protocol: cada fix passou por Tier 1 (re-read da secao editada) e Tier 2 (`npx tsc --noEmit` clean). Baseline tsc estava limpo antes do primeiro fix; nenhum erro novo introduzido.

## Fixed Issues

### CR-01: Race condition em concurrent POSTs corrompe Contact.greenFlags/redFlags/attractionLevel
**Files modified:** `src/app/api/contacts/[id]/encounters/route.ts`
**Commit:** `f0b114a`
**Applied fix:** Moveu read+merge+write do Contact + UserProfile pra dentro de uma transacao interativa `prisma.$transaction(async (tx) => {...}, { isolationLevel: Serializable, timeout: 10_000 })`. Captura `Prisma.PrismaClientKnownRequestError` com code `P2034` (serialization failure / write conflict) e devolve 409 em PT-BR ("Outro encontro foi salvo agora, tenta de novo daqui a pouco."). Snapshot stale entre POSTs simultaneos agora resulta em retry consciente em vez de perda de flags. Sem retry automatico (manter simples — front pede pro user). Tier 2 OK.

### WR-01: GET cursor lookup nao re-valida ownership via nested contact.userId
**Files modified:** `src/app/api/contacts/[id]/encounters/route.ts`
**Commit:** `c6dfd5b`
**Applied fix:** Mudou `where: { id: beforeCursor, contactId }` pra `where: { id: beforeCursor, contact: { id: contactId, userId } }` no cursor lookup do GET. Defesa em profundidade — se um dia o codigo migrar pra `/api/encounters/[id]` sem contact-scope inicial, nested filter previne cross-tenant leak. Tier 2 OK.

### WR-02: useEffect load nao guarda contra id undefined em transition de rota
**Files modified:** `src/app/desenrolos/[id]/page.tsx`
**Commit:** `2abc4b7`
**Applied fix:** Adicionou `if (!id) return;` no topo do useEffect de `loadEncounters`, no `loadMoreEncounters`, e no `submitEncounter` (este ultimo lanca `Error("Página ainda carregando...")` em vez de retornar pra que o modal feedback corretamente). Previne fetches pra `/api/contacts/undefined/encounters` e consumo de quota durante transitions Next 16 Suspense. Tier 2 OK.

### WR-03 + WR-04: normalizeExtract aceita qualquer string como enum + EncounterCard assume extracted completo (RESOLVIDOS JUNTOS)
**Files modified:** `src/app/api/contacts/[id]/encounters/route.ts`, `src/components/encounter/encounter-card.tsx`
**Commit:** `a8d6230`
**Applied fix:** Introduziu helper unico `toEncounterPayload(value: unknown): EncounterExtractPayload` que substitui `normalizeExtract` e centraliza serializacao do shape `extracted` em todos os 3 caminhos do route (degradedFallback inicial, `finalExtract` apos extract Anthropic OK, e leitura GET de rows do DB). `safeEnum<T>(value, set, fallback)` valida `escalation`/`mood`/`attractionDelta` contra `Set<string>` inline (`ESCALATION_SET`, `MOOD_SET`, `DELTA_SET`) — string legacy ou typo do LLM ("ascendente", "feliz", "rise") agora cai no fallback em vez de quebrar `ESCALATION_LABEL[invalid] -> undefined` no card. Defensivo extra no `EncounterCard`: extrai `greens`/`reds`/`userPatterns` com `?? []` antes de ler `.length` e mapear. Tier 2 OK.

### WR-05: formatDate cai pra "Data Inválida" em vez do ISO original
**Files modified:** `src/components/encounter/encounter-card.tsx`
**Commit:** `49ddce0`
**Applied fix:** Removeu o `try/catch` (que nunca disparava — `new Date("garbage")` retorna Invalid Date sem throw, e `Intl.DateTimeFormat.format(invalidDate)` devolve string "Data Inválida"). Substituiu por check explicito `if (Number.isNaN(date.getTime())) return iso;` antes do format. Agora ISO bruto debugavel aparece no UI em vez de "Data Inválida". Tier 2 OK.

### WR-06: Char count usa trimmed mas maxLength HTML usa raw — UX inconsistente
**Files modified:** `src/components/encounter/encounter-capture-modal.tsx`
**Commit:** `e2e2ad3`
**Applied fix:** Separou `rawLen = rawText.length` (display: bate com `maxLength={MAX_CHARS}` do textarea) e `trimmedLen = rawText.trim().length` (submit guard + `tooShort` flag: bate com `z.string().trim().min(MIN_CHARS).max(MAX_RAW_TEXT)` do backend). Resolve discrepancia onde user digitando 4000 chars com whitespace nas pontas via "3999/4000" enquanto o textarea bloqueava em 4000 raw. Tier 2 OK.

### WR-07: bootstrap() apos cada submit refaz lista inteira de contatos
**Files modified:** `src/app/desenrolos/[id]/page.tsx`
**Commit:** `c247d0a`
**Applied fix:** Substituiu `void bootstrap()` por patch direto no Zustand via `useFlirtStore.setState((state) => ({ contacts: state.contacts.map((c) => c.id === id ? { ...c, ...patched } : c) }))`. A route POST ja devolve `contact: serializeContact(...)` no body, entao a chamada extra de GET /api/contacts era pura redundancia (network ~50-200ms + re-render da sidebar global). Removida dependencia `bootstrap` do `useCallback` (continua usado no useEffect de hidratacao). Tipou `data.contact` como `Partial<ContactRecord> & { id: string }` pra o spread funcionar sem `any`. Decisao: usei `setState` inline em vez de adicionar nova action `applyContactPatch` no store (out of scope per orchestrator instructions — store nao expoe action equivalente). Tier 2 OK.

### IN-01: Enums sem acento — documentar decisao
**Files modified:** `src/lib/flirt/encounter-schema.ts`, `docs/DATA-MODEL.md`
**Commit:** `19f227a`
**Applied fix:** Bloco de comentario acima das constantes `ESCALATION_VALUES`/`MOOD_VALUES`/`ATTRACTION_DELTA_VALUES` explicando: Anthropic `input_schema.enum` nao garante unicode normalization no output do LLM (as vezes devolve "avançou" vs "avancou") e mistura faria Zod rejeitar silenciosamente. Frontend traduz pra labels acentuadas via `ESCALATION_LABEL`/`MOOD_LABEL`. Adicionou paragrafo equivalente na secao EncounterLog do DATA-MODEL.md (logo apos shape de `extracted`) referenciando o ficheiro de labels. Tier 3 (sem syntax check necessario).

### IN-02: Imports duplicados de @prisma/client
**Files modified:** `src/app/api/contacts/[id]/encounters/route.ts`
**Commit:** `4570969`
**Applied fix:** Mergeou `import { Prisma } from "@prisma/client"` + `import type { AttractionLevel as PrismaAttractionLevel } from "@prisma/client"` num import unico: `import { Prisma, type AttractionLevel as PrismaAttractionLevel } from "@prisma/client"`. Tier 2 OK.

### IN-05: Documentar invariante de seguranca de EncounterLog
**Files modified:** `prisma/schema.prisma`, `docs/DATA-MODEL.md`
**Commit:** `8634c0a`
**Applied fix:** Bloco SECURITY no comentario acima de `model EncounterLog {}` em schema.prisma reforcando que nao tem `user_id` direto e padrao seguro e `{ where: { contact: { userId } } }`. Bloco equivalente em DATA-MODEL.md (callout `> **SECURITY (IN-05):**` apos `Relations: contact (n-1)` da secao EncounterLog) com snippet de codigo e advertencia contra expor `/api/encounters/[id]` sem nested ownership. Tier 3.

## Skipped Issues

### IN-03: Confirmar EncounterRecord como source de truth no boundary
**File:** `src/components/encounter/encounter-capture-modal.tsx:12-23`, `src/app/desenrolos/[id]/page.tsx:148-182`
**Reason:** Review explicitamente marca como "Out of scope pro W7, mas vale considerar em W8". Adicionar parser Zod no client pra validar response e mudanca de arquitetura defensiva — defer pra wave de polish.
**Original issue:** Sem validacao Zod no client, mudanca da API rompe runtime sem tsc pegar.

### IN-04: Cursor pode ficar stale apos varios submits
**File:** `src/app/desenrolos/[id]/page.tsx:168-172`
**Reason:** Review marca explicitamente: "Sem fix necessario no W7 — anotar pra revisar se aparecer bug 'encontro sumiu da timeline'". Edge case apenas com `happenedAt` manual no passado, nao reproduzido em uso normal. Nenhuma acao tomada.
**Original issue:** Cursor de paginacao pode pular item se user registra encounter com data manual antiga.

---

_Fixed: 2026-05-25T16:00:00Z_
_Fixer: code-fixer (AILA squad)_
_Iteration: 1_
_Verification: Tier 1 (re-read) + Tier 2 (`npx tsc --noEmit` clean) em todos os fixes de codigo. Tier 3 (sem syntax check) nos fixes de doc (IN-01 / IN-05)._
_Commits: 10 fixes atomicos (CR-01, WR-01, WR-02, WR-03+WR-04 combinados, WR-05, WR-06, WR-07, IN-01, IN-02, IN-05)._
