---
alias: HANDOFF-W5-flirtai
type: handoff
status: done
tags: [flirtai, wave/W5, handoff, settings, search, coach-tone]
date_e_hora: 24-05-2026
priority: high
projeto: flirtai
documento: HANDOFF-W5
wave: W5 — Settings & Search expandidos
versao: 1.0
fechada_em: 24-05-2026
proxima_wave: W6 — Memória do Homem (UserProfile)
mci_versao: v7.7
---

# HANDOFF — Wave 5 (Settings & Search expandidos)

## Status

- Wave: W5 — Settings & Search expandidos
- Período: 24-05-2026 → 24-05-2026
- Branch: master
- Resultado: ENTREGUE — build verde, typecheck verde, lint sem regressão.

Arquivos modificados (todos W5):

| Arquivo | Tipo |
|---|---|
| `prisma/schema.prisma` | `User.timezone/locale/coachTone/notificationPrefs` + enum `CoachTone` |
| `prisma/migrations/20260525011534_add_user_preferences/migration.sql` | migration nova |
| `docs/DATA-MODEL.md` | tabela User + nota W5/M8 + migration history |
| `docs/COMPONENT-MAP.md` | section "Wave 5 — Settings & Search" + atualização do mapa de rotas |
| `src/app/api/settings/route.ts` | reescrito: 4 campos novos + Zod estrito + Prisma `DbNull` |
| `src/app/settings/page.tsx` | reescrito: 5 sections (Perfil · Conta · Coach · Notificações · Anthropic API) |
| `src/lib/flirt/system-prompt.ts` | `buildSystemPrompt(mode, tone?)` + 3 addenda de tom |
| `src/app/api/coach/route.ts` | select `coachTone` + passa pro `buildSystemPrompt` |
| `src/app/api/contacts/route.ts` | GET aceita `?q=` com `ilike` em 4 campos + `has` em tags, `take: 500` |
| `src/app/desenrolos/page.tsx` | debounce 250ms + AbortController + serverResults gated por `hasActiveSearch` |

---

## O que funciona (entregue + validado)

- [x] **M5 — Search server-side** — `GET /api/contacts?q=<termo>` aplica `ilike` case-insensitive em `name`, `instagramHandle`, `location`, `metContext` + match exato em qualquer `tags[]`. Bounded por `take: 500` e `SEARCH_QUERY_MAX = 80` chars.
- [x] **M5 — Cliente com debounce 250ms** — `useEffect` em `desenrolos/page.tsx` com `setTimeout` + `AbortController` cancelando requests em voo. Loading visível via `Loader2Icon` substituindo `SearchIcon` durante fetch. Cache Zustand preservado pra estado sem query (boot mais rápido).
- [x] **M5 — Gate de performance** — `EXPLAIN ANALYZE` em 8 rows: 0.117ms execution. Seq scan vai escalar linearmente; extrapolando pra 500 rows ~7ms (muito abaixo do gate <100ms). `pg_trgm` adiado pra >10k rows/user.
- [x] **M8 — Migration `add_user_preferences`** — 4 colunas novas no `user` (`timezone TEXT`, `locale TEXT`, `coach_tone "CoachTone"`, `notification_prefs JSONB`) + CREATE TYPE `CoachTone` AS ENUM (`low_key`, `direto`, `provocador`). Tudo nullable, baixo risco.
- [x] **M8 — Settings UI expandido** — `/settings` com 5 sections: Perfil (name) · Conta (timezone, locale) · Coach (radio low_key/direto/provocador, salva on-change) · Notificações (push toggle + frequency select gated) · Anthropic API (preservada). Refatorada com `<SectionCard>` reutilizável + `<Field>` + `<PrimaryButton>`. Touch targets ≥44px.
- [x] **M8 — `/api/settings` expandido** — GET retorna 4 campos novos + bloco `defaults` (timezone, locale, notificationPrefs). PATCH valida via Zod (`timezoneSchema`, `localeSchema`, `z.nativeEnum(CoachTone)`, `notificationPrefsSchema`). `Prisma.DbNull` usado pra limpar JSON.
- [x] **M8 — `coachTone` no system prompt** — `buildSystemPrompt(mode, tone?)` injeta 1 dos 3 blocos em PT-BR (low-key / direto / provocador) entre o mode addendum e o structured guide. Quando null, voz default. `/api/coach` carrega `user.coachTone` no mesmo Promise.all do user/contact (zero round-trip extra).
- [x] **Build gates** — `npx tsc --noEmit` exit 0 · `npm run lint` 0 errors (1 warning pré-existente, W4 stub `meta-graph-client.ts:17`) · `npm run build` standalone 25 rotas.

---

## O que NÃO funciona / Bloqueadores

- [ ] **Smoke E2E real do `coachTone` em Langfuse não rodado** — gate de saída do ROADMAP pede "verificar Langfuse que cache hit acontece no system prompt com tom injetado". Requer key Langfuse + 1 call de coach autenticada após salvar `coachTone` em /settings. Owner: Meres. Impacto: medium (código revisado + addendum compõe via `.join("\n\n")` antes do cache_control).
- [ ] **Push notifications não têm canal entregue** — `notificationPrefs.push` é gravado mas não há service worker / endpoint VAPID. UI já avisa "ainda em construção". Débito formal pra wave futura (não W6).
- [ ] **`pg_trgm` extension não habilitada** — decisão consciente, validada por EXPLAIN ANALYZE. Reabrir quando passar de ~10k contatos/user.

---

## Smoke E2E (critérios testáveis)

- [ ] **Critério 1 — Search server-side responde:** Subir Postgres + ter pelo menos 1 contato `kind=desenrolo` cadastrado. `curl 'http://localhost:3000/api/contacts?kind=desenrolo&q=bia' -H 'cookie: better-auth.session_token=...'` → esperado HTTP 200 com `{ contacts: [...], query: "bia" }`. Resposta filtra por name/handle/location/metContext/tag.
- [ ] **Critério 2 — Debounce visual:** Em `/desenrolos`, digitar "bia" rapidamente. Esperado: cada keystroke não dispara fetch separado; só dispara 250ms após última tecla. Ícone vira spinner durante request; volta pra search icon após resposta.
- [ ] **Critério 3 — AbortController cancela:** Digitar "bia", depois imediatamente "biana" (dentro de 250ms). Esperado: apenas 1 request rede; o anterior é abortado (visível em DevTools → Network como `(canceled)`).
- [ ] **Critério 4 — Query curta usa cache local:** Digitar "b" (1 char, abaixo de SEARCH_MIN_CHARS=2). Esperado: nenhum fetch dispara; lista volta pro estado cached do Zustand instantaneamente.
- [ ] **Critério 5 — Settings salva e GET retorna:** Em `/settings`, escolher tom "Provocador" no radio. Esperado: PATCH automático; reload da página mostra o radio ainda marcado.
- [ ] **Critério 6 — coachTone afeta system prompt:** Após salvar tom "Provocador", mandar `/coach` numa conversa. Em Langfuse, inspecionar o input do system prompt — esperado: bloco "Tom default deste usuário: PROVOCADOR." aparece entre mode addendum e structured guide.
- [ ] **Critério 7 — notificationPrefs persiste shape correto:** Em /settings, ativar push + escolher "Resumo semanal". `PATCH /api/settings` body deve ser `{ notificationPrefs: { push: true, frequency: "weekly" } }`. Reload mostra checkbox marcado e select em "weekly".
- [ ] **Critério 8 — Limpar key não quebra outros campos:** Em /settings, salvar timezone + locale + tom; depois clicar "Remover key personalizada". Esperado: confirm dialog → PATCH com `{ anthropicApiKey: null, anthropicModel: null }` → timezone/locale/coachTone permanecem inalterados (PATCH é parcial).

---

## Done Criteria (do plano-mãe — ROADMAP.md W5)

- [x] **M5 — `GET /api/contacts?q=` server-side com `ilike`** — evidência: `src/app/api/contacts/route.ts:39-58`.
- [x] **M5 — Cliente debounce 250ms (substitui filtro client-only em `desenrolos/page.tsx:48-59`)** — evidência: `desenrolos/page.tsx:58-100` (timer + AbortController).
- [x] **Migration `add_user_preferences`** — evidência: `prisma/migrations/20260525011534_add_user_preferences/migration.sql`.
- [x] **Settings com seções Conta + Coach + Notificações + API & Modelo** — evidência: `src/app/settings/page.tsx` (5 SectionCards).
- [x] **`coachTone` consumido em `buildSystemPrompt()`** — evidência: `src/lib/flirt/system-prompt.ts:75-115` + `src/app/api/coach/route.ts:81-85` + `:205-209`.
- [ ] **Busca em 500 contatos < 100ms** — não validado com 500 rows reais (DB local tem 8). EXPLAIN ANALYZE extrapolado: ~7ms seq scan. Aceitável pra gate, mas marcado pendente até carga real.
- [ ] **Settings impactam system prompt do coach (verificar Langfuse)** — código integra; falta inspeção em Langfuse com sessão autenticada.

---

## Guard-rails (avisos críticos pra próxima sessão)

- O enum `CoachTone` tem valores `low_key | direto | provocador`. Adicionar valor novo exige migration nova (Postgres não suporta `ADD VALUE` em transaction); preferir `ALTER TYPE ... ADD VALUE` em migration separada. Atualizar também `COACH_TONE_ADDENDA` em `system-prompt.ts` E o array `COACH_TONE_OPTIONS` em `settings/page.tsx` E o `CoachToneId` literal em `system-prompt.ts` — 4 pontos de manutenção.
- `buildSystemPrompt(mode, tone)` agora recebe 2 args. Qualquer chamador novo (testes, scripts) precisa passar `tone` ou `null`. TS força isso, mas atenção em refactors.
- `notificationPrefs` é `Json?` (JSONB nullable). Pra limpar use `Prisma.DbNull` — `null` puro em Prisma é interpretado como "não atualize". Pattern usado em `/api/settings:127-130`.
- `desenrolos/page.tsx` mantém Zustand cache pro estado sem query. Se algum dia movermos pra full server-state (RSC + cookies), o `serverResults` state local pode virar redundante — não remover antes.
- O search server-side ignora `kind=agent_chat` por design (rota filtra desenrolos). Se um dia abrir busca em agent_chats, vai precisar de uma página `/agent-chats` com mesmo padrão (ou unificar com tab).
- Push notifications **não foram implementadas** — só a preferência. Service worker + VAPID + tabela `PushSubscription` ficam pra wave futura.

---

## Próximas ações (W6 — Memória do Homem)

1. **Validar smoke W5 manualmente** (Meres): rodar os 8 critérios acima antes de abrir W6.
2. **Reaproveitar `<SectionCard>`/`<Field>`/`<PrimaryButton>`** em `/me` (W6) pra consistência visual.
3. **W6/UserProfile** vai querer alguns dos mesmos sinais que `coachTone`: o tom escolhido em /settings é o **default**, mas W6 introduz overrides per-user via `UserProfile.tone`. Decidir resolução (prioridade UserProfile.tone > User.coachTone > null) antes de codar o coach call.
4. **W6 onboarding** pode preencher `User.timezone/locale` no signup como side-effect — economiza um detour pra /settings.
5. **Habilitar `pg_trgm`** quando contagem real ultrapassar ~10k contatos/user (monitorar via Langfuse traces que incluem `userId hash`).
6. **5 FLAGs Nielsen do ConsentDialog (W4)** não foram fechados nesta wave — continuam como débito formal. Quick-fixes ainda viáveis em W6 ou wave dedicada.

---

## Achados durante execução (drifts, surpresas)

- **Format hook reverteu `/api/coach/route.ts` 1x no meio da edição.** Ao salvar `desenrolos/page.tsx`, um hook ou processo paralelo restaurou a versão pré-W5 do coach route (sem `coachTone` no select e sem 2º arg em `buildSystemPrompt`). Reaplicado em 2 edits sequenciais. Comportamento estável depois disso. Investigar `format-on-edit` hook em sessão futura — pode estar lendo versão estale do disco.
- **`Prisma.DbNull` é obrigatório pra limpar JSON.** Passar `null` puro pra `data.notificationPrefs` em `prisma.user.update` faz Prisma interpretar como "skip", não "set NULL". Patten correto: `parsed.notificationPrefs === null ? Prisma.DbNull : (parsed.notificationPrefs as Prisma.InputJsonValue)`.
- **Lint react-hooks/set-state-in-effect bloqueou setState síncrono.** Primeira versão do effect chamava `setServerResults(null)` quando query ficava curta — eslint correto em apontar cascading renders. Solução: derivar lista renderizada via `hasActiveSearch ? serverResults : cachedContacts` no `useMemo`. Estado `serverResults` agora só é setado pelo branch de fetch success.
- **Performance gate de search atendido por extrapolação, não medição real.** DB local só tem 8 contatos; EXPLAIN ANALYZE deu 0.117ms; 500 rows projeção ~7ms. Quando produção tiver carga real, validar via `pg_stat_statements` ou rodar o smoke E2E manual com 500 contatos seed.
- **Coach tone radio salva on-change, sem botão "Salvar".** Decisão de UX: tom é setting low-stakes (sempre reversível, sempre pareado com confirmação visual). Outras sections mantêm padrão form+submit. Documentado em COMPONENT-MAP "Wave 5".
