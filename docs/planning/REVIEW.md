---
reviewed: 2026-05-25T03:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - prisma/schema.prisma
  - prisma/migrations/20260525020000_create_user_profile/migration.sql
  - src/app/api/me/profile/route.ts
  - src/app/api/me/profile/feedback/route.ts
  - src/app/api/me/profile/onboarding/route.ts
  - src/lib/flirt/me-context.ts
  - src/lib/flirt/me-onboarding.ts
  - src/app/api/coach/route.ts
  - src/app/me/page.tsx
  - src/app/me/onboarding/page.tsx
  - src/components/me-banner-cta.tsx
  - src/components/me-onboarding-modal.tsx
  - src/components/me-onboarding-wizard.tsx
  - src/components/suggestion-feedback.tsx
  - src/components/flirt-ai-shell.tsx
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
---

# Code Review Report

**Reviewed:** 2026-05-25T03:00:00Z
**Depth:** standard
**Files Reviewed:** 14 (15 paths — `me-onboarding-wizard.tsx` e `flirt-ai-shell.tsx` revisados apenas no diff W6)
**Status:** issues_found

## Summary

Wave 6 ("Memória do Homem") entrega o modelo `UserProfile` 1-1 com `User`, três rotas API (`/api/me/profile` GET/PATCH/DELETE, `/feedback` POST, `/onboarding` POST), o builder `buildMeContext`, integração no `/api/coach` com dois prefixos cacheados e três pontos de entrada UI (`/me`, `/me/onboarding`, modal pós-signup, banner CTA). A arquitetura está sólida: multi-tenant defense em todas as rotas, Zod parsing em todo payload, upsert lazy que evita registros zumbis, e tone resolution na ordem correta (`userProfile.tone ?? user.coachTone ?? null` com nullish coalescing).

**O concern dominante é um bug crítico de wiring (CR-01):** o `messageId` retornado pelo `/api/coach` no evento `done` é capturado pelo shell mas **não é propagado** dentro de `applyCoachResponse` no store — o assistant `ConversationMessage` é construído com `id: crypto.randomUUID()` no client, ignorando o cuid real do banco. Resultado: todo POST de feedback envia o UUID local, que nunca existe na tabela `message`, e a rota responde 404. **A feature de feedback está quebrada end-to-end** desde o commit `6a89046` apesar de typecheck/lint/build verdes — não há testes pra pegar isso.

Demais findings são warnings de robustez (cap "dedup" muda ordem do feedback mais recente; AbortSignal não propagado nas fetches client; sem indicador visual de loading no banner/modal; PATCH aceita body vazio silenciosamente) e infos de qualidade (duplicação de catálogos de enum entre `lib/flirt/me-onboarding.ts` e as routes; magic numbers de cap espalhados em 3 arquivos; comentário desatualizado em `me-context.ts`).

A revisão é compatível com Tier 1: Prisma + Postgres + Next 16 + Zod-first + Naming Lock estão respeitados. Migration SQL é trivial e segura (apenas CREATE TABLE + FK CASCADE). `cache_control: ephemeral` em dois blocos do system prompt é correto (Anthropic permite múltiplos breakpoints; o `me-context` muda só quando o user edita `/me` ou marca feedback, o que torna o cache rentável).

## Critical Issues

### CR-01: Feedback de sugestão sempre 404 — `messageId` do servidor é descartado no client

**File:** `src/store/use-flirt-store.ts:197` (consumidor: `src/components/flirt-ai-shell.tsx:929` + `src/app/api/me/profile/feedback/route.ts:62-66`)

**Issue:**
O coach SSE retorna `{ ...CoachChatResponse, messageId: assistantMessage.id }` no evento `done` (`src/app/api/coach/route.ts:422-429`). O shell **captura** esse `messageId` em `donePayload` (`flirt-ai-shell.tsx:562, 596`) e chama `applyCoachResponse(contactId, donePayload!)`. Porém `applyCoachResponse` em `use-flirt-store.ts:194-204` cria o assistant `ConversationMessage` com:

```ts
const assistantMessage: ConversationMessage = {
  id: crypto.randomUUID(),   // <-- ignora response.messageId
  sender: "assistant",
  ...
};
```

Quando o `<SuggestionCard>` renderiza `<SuggestionFeedback messageId={message.id} ... />` (`flirt-ai-shell.tsx:929`), passa o UUID local. O POST em `/api/me/profile/feedback` faz `prisma.message.findFirst({ where: { id: parsed.messageId, contact: { userId } } })` (route.ts:62-66) — o UUID nunca casa com um cuid de `Message.id`, e a API responde **404 "Mensagem não encontrada."** em 100% dos cliques de `[Funcionou]` / `[Não rolou]`.

Sintomas observáveis: zero linhas crescendo em `winSamples`/`redPatternsRaw` em produção, optimistic UI volta com erro "Mensagem não encontrada." no usuário. Tipagem não pega porque `messageId: string` casa com qualquer string. Lint/typecheck/build verdes confirmam que sem teste E2E isso passa direto. Multi-tenant defense não é afetado (o `where: { contact: { userId } }` só seria atingido se o id casasse, o que nunca acontece).

**Fix:** No store, threadar o `messageId` do server na criação do assistant message. Aceite o payload completo já tipado com `messageId` e use o id do server quando presente, com fallback pra UUID local só em path de erro:

```ts
// src/store/use-flirt-store.ts (~linha 195)
applyCoachResponse: (contactId, response) =>
  set((state) => {
    const assistantMessage: ConversationMessage = {
      // W6 — usa o id real do DB (vem no evento "done"); fallback só
      // se algum caller antigo ainda não thread o messageId.
      id: response.messageId ?? crypto.randomUUID(),
      sender: "assistant",
      content: response.assistantMessage,
      timestamp: new Date().toISOString(),
      suggestions: response.suggestions,
      insight: response.insight,
    };
    // ...resto inalterado
  }),
```

E no tipo `CoachChatResponse` (ou no parâmetro de `applyCoachResponse`), exigir `messageId: string`. Como bonus, no shell `flirt-ai-shell.tsx:927`, trocar a guard `message.id ? ... : null` por uma checagem mais explícita do shape esperado (cuid ≠ uuid v4) — opcional, mas evita renderizar `<SuggestionFeedback>` em casos onde o fallback de erro foi disparado e o id é UUID local. Sugestão concreta:

```tsx
{message.id && message.sender === "assistant" && !message.id.includes("-") ? (
  <SuggestionFeedback messageId={message.id} suggestionIndex={suggestionIndex} />
) : null}
```

(cuids do Prisma não têm hífen; UUIDs têm. Heurística barata sem mexer no tipo agora.)

## Warnings

### WR-01: `appendCapped` dedup faz feedback duplicado pular pra o fim — distorce o "recente" + conflito cross-array

**File:** `src/app/api/me/profile/feedback/route.ts:130-138`

**Issue:**
A função `appendCapped` faz `arr.filter((v) => v !== item)` + `push(item)`. Isso é dedup correto, mas tem um side effect: se o usuário marcar a mesma sugestão como `worked` duas vezes (clicar [Funcionou] → mudar de ideia → clicar de novo após algum tempo), o item é **movido** pro fim do array. `buildMeContext` faz `.slice(-RENDER_CAP)` pra pegar os 12 mais recentes — então um feedback antigo "promovido" desloca um feedback genuinamente recente. Não é loss-of-data (o item continua no array), mas o sinal de "recência" fica distorcido.

Adicionalmente, no rating oposto (user clica `worked` e depois muda pra `didnt_work` na mesma sugestão), o texto entra em `redPatternsRaw` **sem ser removido de `winSamples`** — fica nos dois arrays simultaneamente, e o coach recebe instrução contraditória ("já funcionou" + "evite repetir") na mesma sugestão.

**Fix:**
1. Para dedup-preservando-posição-original, troque `filter + push` por uma checagem prévia:
```ts
function appendCapped(arr: string[], item: string, cap: number): string[] {
  if (arr.includes(item)) return arr;         // já está, não move
  const next = [...arr, item];
  return next.length > cap ? next.slice(next.length - cap) : next;
}
```
2. Para resolver o conflito cross-array, na rota antes do upsert, remova `suggestionText` do array oposto:
```ts
// Em /api/me/profile/feedback/route.ts, dentro de cada branch de rating:
const wins = asStringArray(current.winSamples);
const redsRaw = asStringArray(current.redPatternsRaw);

if (parsed.rating === "worked") {
  const cleanReds = redsRaw.filter((v) => v !== suggestionText);
  const nextWins = appendCapped(wins, suggestionText, WIN_SAMPLES_CAP);
  await prisma.userProfile.update({
    where: { userId },
    data: {
      winSamples: nextWins as unknown as Prisma.InputJsonValue,
      ...(cleanReds.length !== redsRaw.length
        ? { redPatternsRaw: cleanReds as unknown as Prisma.InputJsonValue }
        : {}),
    },
  });
} // espelhar pra didnt_work
```

### WR-02: `<SuggestionFeedback>` permite trocar rating sem confirmação visual + race condition em clicks rápidos

**File:** `src/components/suggestion-feedback.tsx:28-51`

**Issue:**
Depois do primeiro POST 200, `status` vira `"sent"` e fica permanente — o handler só ignora cliques se `status === "sending"` (linha 29). Na prática isso permite trocar `worked → didnt_work`, MAS:
1. Não há feedback visual de que o segundo clique também gravou (o ícone trocou, mas o badge "guardado" não pulsa novamente).
2. Se o usuário clicar 3 vezes rapidamente, dispara 3 POSTs em paralelo (a guard só protege contra duplo-clique enquanto `"sending"`, mas após `"sent"` qualquer clique novo dispara). Com `rate_limit = 120/h` é tolerável, mas tem race: o último POST que chegar no banco "vence", e o `previous = rating` capturado no closure pode estar desatualizado se o usuário clicou 3x em ratings diferentes.

**Fix:** Bloquear ações após sucesso, ou apenas considerar `"sent"` final (botões disabled após sucesso, exibindo "guardado"). Já que W6 escolheu não classificar e a UX é "thumbs simples", o caminho mais consistente é tornar a ação irreversível por turno:

```tsx
// suggestion-feedback.tsx
async function send(next: Rating) {
  if (!next || status === "sending" || status === "sent") return;  // bloqueia após sucesso
  // ...resto inalterado
}
// botões: disabled={disabled || status === "sending" || status === "sent"}
```

Se Meres quiser permitir mudança de ideia, exponha um "Desfazer" explícito que faz DELETE + nova POST (e adicione um endpoint DELETE em `/api/me/profile/feedback`).

### WR-03: `fetch` em client components não propaga AbortSignal — race condition em StrictMode/unmount

**File:** `src/components/me-banner-cta.tsx:30`, `src/components/me-onboarding-modal.tsx:37`, `src/app/me/page.tsx:61`, `src/components/suggestion-feedback.tsx:35`

**Issue:**
`useEffect` em `MeBannerCta` e `MeOnboardingModal` faz `fetch("/api/me/profile")` e usa flag `cancelled` pra evitar `setState` em componente unmounted. Mas o fetch em si **não é abortado**: a request continua usando bandwidth e mantém uma conexão. Em React 19 StrictMode + Next 16 (com double-mount em dev), dispara duas fetches por mount, ambas resolvendo. Em prod o impacto é menor, mas não é ideal — e em `MeOnboardingModal` há um path onde `cancelled=true` PORÉM o usuário re-monta o componente (route transition em SPA) e o `setOpen(true)` da segunda fetch pode reabrir o modal depois de já ter sido fechado pelo handler de skip.

A página `/me` (`me/page.tsx:61`) tem o mesmo padrão sem AbortController. `SuggestionFeedback.send` (suggestion-feedback.tsx:35) também não usa signal — se o usuário fechar a aba, o POST fica "pendurado" e o optimistic UI nunca recebe a confirmação (irrelevante após unmount, mas vaza recursos).

**Fix:** Trocar a flag `cancelled` por `AbortController` real:

```ts
useEffect(() => {
  const ac = new AbortController();
  void load();
  return () => ac.abort();

  async function load() {
    try {
      if (window.sessionStorage.getItem(SESSION_DISMISS_KEY)) return;
      const response = await fetch("/api/me/profile", { cache: "no-store", signal: ac.signal });
      if (!response.ok) return;
      const { userProfile } = (await response.json()) as { ... };
      if (!userProfile.onboardingDone) setOpen(true);
    } catch (cause) {
      if ((cause as Error).name === "AbortError") return;
      // silencioso
    }
  }
}, []);
```

Aplicar nos 4 arquivos. `<SuggestionFeedback>` pode usar um ref-based `AbortController` se houver risco de o componente desmontar antes da resposta (raro nesse fluxo, mas barato adicionar).

### WR-04: Banner CTA + Modal disparam 2 fetches duplicados a `/api/me/profile` por mount

**File:** `src/components/me-banner-cta.tsx:30` + `src/components/me-onboarding-modal.tsx:37`

**Issue:**
Ambos `MeBannerCta` e `MeOnboardingModal` são montados via `<FlirtAiShell />` (linha 844 + 1245 no diff). Cada um faz seu próprio `GET /api/me/profile` em `useEffect`. Resultado: a página inicial dispara **duas chamadas idênticas** ao mesmo endpoint em paralelo (e mais uma se `/me` for visitada depois, totalizando 3+ por sessão típica). Em Next 16 com `dynamic = "force-dynamic"`, isso significa duas queries Prisma `upsert` + duas chamadas a `requireUser()` na mesma request HTTP cycle do user.

Não é bug funcional (idempotência segura), mas é desperdício direto. Em PageSpeed/RUM, isso aparece como duplicate XHR no waterfall. Em conjunto com o coach turn (que também faz `select: { userProfile: { ... } }`), o profile é lido 3x em ~10s da landing inicial.

**Fix:**
Centralizar o fetch em um `useMeProfile()` hook em `src/lib/use-me-profile.ts` que cacheia o resultado em memória do client (ou no `useFlirtStore`) e expõe `{ profile, loading, refetch }`. Ambos componentes consomem do mesmo hook. Alternativa mais barata: incluir `userProfile.onboardingDone` no payload de `/api/contacts` (que o shell já chama em bootstrap) via `prisma.user.findUnique({ ... select: { userProfile: { select: { onboardingDone: true } } } })` e dispensar fetch separado.

### WR-05: Caps duplicados em 3 arquivos (`RENDER_CAP = 12`, DB caps 100/200, page slice 20) — desincronização silenciosa

**File:** `src/lib/flirt/me-context.ts:22` + `src/app/api/me/profile/feedback/route.ts:16-17` + `src/app/me/page.tsx:325, 348`

**Issue:**
`me-context.ts` faz `slice(-12)` pra capar quantos itens entram no system prompt. `feedback/route.ts` capa o array DB em 100/200. A página `/me` faz `slice(-20).reverse()` pra listar wins e reds. Três caps em três arquivos pro mesmo dado.

Hoje funciona, mas se algum dia W8 trocar o storage layer (ex: agregar em outra tabela), qualquer um dos três pode ficar desincronizado sem alarme. Especialmente perigoso: render cap de 12 < page cap de 20 — o usuário vê "20 wins" na UI mas o coach só lê 12.

**Fix:**
Exportar constantes de um novo `src/lib/flirt/me-limits.ts` e importar nos 3 sites:

```ts
// src/lib/flirt/me-limits.ts
export const WIN_SAMPLES_DB_CAP = 100;
export const RED_PATTERNS_RAW_DB_CAP = 200;
export const ME_CONTEXT_RENDER_CAP = 12;
export const ME_PAGE_DISPLAY_CAP = 20;
```

Não muda comportamento, mas evita drift quando a Wave 8 (consolidador) chegar.

### WR-06: PATCH em `/api/me/profile` aceita body vazio `{}` — Nielsen H5 (prevenção)

**File:** `src/app/api/me/profile/route.ts:70-105`

**Issue:**
Se o frontend mandar `PATCH {}`, `patchSchema.parse` aceita (todos os campos são `optional`), `data = {}`, e o `prisma.userProfile.upsert` faz update com objeto vazio (noop). A rota responde 200 com o profile inalterado. Aparenta funcionar, mas mascara bugs do frontend (ex: form que envia sem detectar dirty state) — Nielsen H5 (prevenção): a API deveria sinalizar "nada pra atualizar".

Também: `parsed.demographics === null` é tratado como "nullify" (linha 92-94), mas o validator aceita `demographics: undefined` que cai no `else` e não toca o campo — comportamento correto mas não documentado. A distinção `null vs undefined` não está clara no comentário.

**Fix:** Validar que ao menos um campo foi enviado:

```ts
if (Object.keys(data).length === 0) {
  return NextResponse.json(
    { error: "Envie ao menos um campo pra atualizar." },
    { status: 400 },
  );
}
```

E adicionar um comentário acima da linha 91 explicitando que `undefined = não toca; null = nullify`. Decisão fica com Meres — Tier 1 não exige isso, é polish defensivo.

## Info

### IN-01: Duplicação de `CONTEXT_LIFE_OPTIONS` / `RELATIONSHIP_OPTIONS` entre `lib/` e routes

**File:** `src/lib/flirt/me-onboarding.ts:5-20` vs `src/app/api/me/profile/route.ts:16-31` vs `src/app/api/me/profile/onboarding/route.ts:14-29`

**Issue:**
Três fontes da verdade para o mesmo enum. A versão da `lib/flirt/me-onboarding.ts` tem objetos `{ id, label }`; as versões nas routes têm só os ids (`as const` arrays). Hoje os ids batem 100% (`viuvo`, `corporativo`, etc.), mas se alguém adicionar uma opção em um lugar só, vai falhar no Zod e a UI vai mostrar valor que o backend rejeita.

**Fix:** Exportar ids de `me-onboarding.ts` e importar nas routes:

```ts
// me-onboarding.ts
export const CONTEXT_LIFE_IDS = CONTEXT_LIFE_OPTIONS.map((o) => o.id) as [ContextLifeId, ...ContextLifeId[]];
// route.ts
import { CONTEXT_LIFE_IDS } from "@/lib/flirt/me-onboarding";
const patchSchema = z.object({
  contextLife: z.enum(CONTEXT_LIFE_IDS).nullable().optional(),
  // ...
});
```

### IN-02: Comentário desatualizado em `me-context.ts:5-6`

**File:** `src/lib/flirt/me-context.ts:5-6`

**Issue:**
Comentário menciona "cap defensivo de 12 itens cada na render" como inline number. Logo abaixo (linha 22) está `const RENDER_CAP = 12`. Só referenciar a constante deixa mais robusto.

**Fix:** Trocar "(cap defensivo de 12 itens cada na render, mesmo que o DB guarde até 100/200)" por "(cap RENDER_CAP definido abaixo; o DB guarda até WIN_SAMPLES_CAP/RED_PATTERNS_RAW_CAP — ver feedback/route.ts)".

### IN-03: DELETE `/api/me/profile` — adicionar TODO sobre LGPD vs W8 consolidador

**File:** `src/app/api/me/profile/route.ts:113-126`

**Issue:**
O update do DELETE zera corretamente `winSamples`, `redPatternsRaw`, `redPatterns`. Mas quando W8 implementar o consolidador, precisa garantir que ele respeita o reset (não recria `redPatterns` a partir de logs antigos depois de o user limpar).

**Fix:** Comentário inline:

```ts
// W8 TODO: o consolidador deve checar updatedAt > lastConsolidationAt pra
// respeitar limpeza de memória (LGPD).
```

### IN-04: `materializeCreate` — nome sugere construção, função apenas filtra null/undefined

**File:** `src/app/api/me/profile/route.ts:165-177`

**Issue:**
Nome `materializeCreate` é ambíguo. Lendo o corpo, o que ela faz é filtrar campos `null/undefined` antes de passar pro `create`. `parsed.demographics != null` (linha 173) é correto (cobre null+undefined). Sem bug — só clareza.

**Fix:** Renomear para `nonNullableCreateFields` ou inline a função (12 linhas, único callsite na linha 101).

### IN-05: Magic strings `"me-feedback"`, `"coach"` espalhadas como route keys em rate limit

**File:** `src/app/api/me/profile/feedback/route.ts:37` + `src/app/api/coach/route.ts:82`

**Issue:**
Strings literais para keys de rate limit. Se outro lugar precisar consultar o mesmo bucket, fácil errar a string. Não é bug — só fragilidade.

**Fix:** Constantes em `src/lib/rate-limit.ts`:

```ts
export const RATE_LIMIT_ROUTES = {
  COACH: "coach",
  ME_FEEDBACK: "me-feedback",
} as const;
```

---

_Reviewed: 2026-05-25T03:00:00Z_
_Reviewer: code-reviewer (AILA squad)_
_Depth: standard_
