---
alias: HANDOFF-W6-flirtai
type: handoff
status: done
tags: [flirtai, wave/W6, handoff, user-profile, memoria-do-homem, onboarding, feedback]
date_e_hora: 24-05-2026
priority: high
projeto: flirtai
documento: HANDOFF-W6
wave: W6 — Memória do Homem (UserProfile)
versao: 1.0
fechada_em: 24-05-2026
proxima_wave: W7 — Diário de Campo (EncounterLog)
mci_versao: v7.7
---

# HANDOFF — Wave 6 (Memória do Homem)

## Status

- Wave: W6 — Memória do Homem (UserProfile)
- Período: 24-05-2026 → 24-05-2026
- Branch: master
- Resultado: ENTREGUE — build verde, typecheck verde, lint sem regressão (2 warnings pré-existentes mantidos).

Arquivos modificados/criados (todos W6):

| Arquivo | Tipo |
|---|---|
| `prisma/schema.prisma` | + model `UserProfile` + relation 1-1 em `User.userProfile` |
| `prisma/migrations/20260525020000_create_user_profile/migration.sql` | migration nova: CREATE TABLE `user_profile` + FK cascade |
| `docs/DATA-MODEL.md` | seção `UserProfile`, nota tone resolution, migration history |
| `docs/COMPONENT-MAP.md` | seção `Wave 6 — Memória do Homem` (hierarquia + fluxos + Nielsen + naming lock) |
| `docs/ROADMAP.md` | W6 marcado ✅ DONE — 24-05-2026, versao 1.2 |
| `src/app/api/me/profile/route.ts` | GET (upsert lazy) · PATCH (Zod parcial) · DELETE (zera memória, preserva onboardingDone) |
| `src/app/api/me/profile/feedback/route.ts` | POST sem classificador — grava raw em winSamples/redPatternsRaw com cap 100/200 |
| `src/app/api/me/profile/onboarding/route.ts` | POST idempotente — seta onboardingDone=true |
| `src/app/api/coach/route.ts` | select inclui `userProfile`; tone resolution `userProfile.tone > user.coachTone > null`; inject `buildMeContext` como bloco cached separado |
| `src/lib/flirt/me-context.ts` | nova — `buildMeContext(profile)` retorna bloco PT-BR com cap render 12 itens cada |
| `src/lib/flirt/me-onboarding.ts` | nova — catálogo de opções (CONTEXT_LIFE/RELATIONSHIP/COACH_TONE) + `answersToPayload` |
| `src/app/me/page.tsx` | nova — visualização, edição inline, lista winSamples/redPatterns, botão limpar memória |
| `src/app/me/onboarding/page.tsx` | nova — wizard 6-steps full-screen mobile-first |
| `src/components/me-onboarding-wizard.tsx` | nova — wizard compartilhado (modal + página) |
| `src/components/me-onboarding-modal.tsx` | nova — auto-abre pós-signup, dismiss session-storage |
| `src/components/me-banner-cta.tsx` | nova — banner persistente no shell, dismissable 7d via localStorage |
| `src/components/suggestion-feedback.tsx` | nova — botões [Funcionou]/[Não rolou] inline em cada SuggestionCard |
| `src/components/flirt-ai-shell.tsx` | imports W6, inject `<MeBannerCta>` topo da timeline, `<MeOnboardingModal>` no fim do tree, `<SuggestionFeedback>` em cada sugestão (map agora com `suggestionIndex`) |

---

## O que funciona (entregue + validado)

- [x] **Schema-First completo** — `UserProfile` em `prisma/schema.prisma` + migration `20260525020000_create_user_profile` + atualização de `docs/DATA-MODEL.md` (seção entidade + migration history) + atualização de `docs/COMPONENT-MAP.md` (seção Wave 6 com hierarquia/fluxos/Nielsen/naming lock).
- [x] **Migration SQL** — CREATE TABLE `user_profile` com PK `user_id`, FK CASCADE pra `user`, JSONB defaults `'[]'` em winSamples/redPatternsRaw/redPatterns, BOOL default false em `onboarding_done`. Validada via `npx prisma validate` + `prisma generate` (client v7.8.0). **Não aplicada em DB** porque docker não tá no host; rodará no próximo `prisma migrate deploy` (start do container Coolify).
- [x] **`/api/me/profile`** — GET (upsert lazy cria stub se não existir), PATCH (Zod parcial: tone/age/locationCity/contextLife/demographics; `null` nullifica; `undefined` ignora), DELETE (zera arrays + nullifica campos pessoais, **preserva onboardingDone**).
- [x] **`/api/me/profile/feedback`** — POST com Zod `{ messageId, suggestionIndex, rating }`. Lê texto de `Message.suggestions[suggestionIndex].text` via Prisma com `where: { contact: { userId } }` (defesa multi-tenant). Append com dedup + cap 100/200 (drop oldest). Rate-limit 120/h via `UsageLog` route `me-feedback`. **Sem LLM** — decisão Wave 6.
- [x] **`/api/me/profile/onboarding`** — POST idempotente. Sempre seta `onboardingDone=true` (mesmo `skipped: true`). Idempotente: chamar 2x atualiza, não duplica.
- [x] **`lib/flirt/me-context.ts`** — `buildMeContext(profile)` retorna string PT-BR ou `null` quando vazio. Cap defensivo de render 12 itens por lista (mesmo que DB guarde 100/200). Truncate de 220 chars por item. Quando só tem `redPatternsRaw` (sem `redPatterns` consolidados), injeta nota de count em vez do conteúdo cru.
- [x] **`/api/coach` integração** — select agora inclui `userProfile` (com select específico). `effectiveTone = userProfile?.tone ?? user.coachTone ?? null` (tone resolution W6 > W5 > default). `meContextBlock` adicionado como bloco `cache_control: ephemeral` separado entre `base` e `toneAddendum` — Anthropic suporta múltiplos breakpoints, o me-context vira um segundo prefixo cacheado por user.
- [x] **Página `/me`** — formulário (idade, cidade, contexto, estado civil, filhos, tom override), lista winSamples (verde), lista redPatterns (âmbar) ou fallback contando redPatternsRaw, botão "Limpar memória" (LGPD) com confirm. Reaproveita padrão visual de `<SectionCard>`/`<Field>`/`<PrimaryButton>` do `/settings` (sem importar — pra evitar acoplamento, copiado deliberadamente). Banner "Fazer onboarding guiado" aparece quando `onboardingDone=false`.
- [x] **Página `/me/onboarding`** — wizard 6-perguntas full-screen mobile-first. Cada passo: input grande, "Pular tudo" sempre visível no rodapé, voltar/próximo, barra de progresso. Após POST → redirect `/`.
- [x] **`<MeOnboardingModal>`** — auto-abre na 1ª visita ao shell pós-signup (lê `GET /api/me/profile` → `onboardingDone=false`). Dismiss via `sessionStorage.me-onboarding-modal-dismissed` (volta a abrir em próxima sessão se ainda não preencheu). Compartilha o `<OnboardingWizard />` com a página.
- [x] **`<MeBannerCta>`** — renderiza no topo da timeline do shell quando `onboardingDone=false`. Dismiss 7d via `localStorage.me-banner-dismissed-until`. CTA "Personalizar agora" → `/me/onboarding`.
- [x] **`<SuggestionFeedback>`** — botões inline `[Funcionou]` / `[Não rolou]` em cada SuggestionCard. Optimistic UI (pinta rating antes da rede, reverte se falhar). Status: idle → sending (spinner) → sent (check + "guardado") → erro (toast). `event.stopPropagation()` no wrapper pra não disparar `fillSuggestion` quando user só quer dar feedback.
- [x] **Shell integração** — `<MeBannerCta />` topo da timeline (logo dentro do `<div className="mx-auto flex max-w-3xl flex-col gap-4 pb-10">`). `<MeOnboardingModal />` no fim do tree principal. SuggestionCard refatorado de `<button>` único pra `<div>` com `<button>` interno + `<SuggestionFeedback>` ao final — preserva click-to-fill mas habilita feedback sem nested-button violation.
- [x] **Build gates verdes** — `npx tsc --noEmit` exit 0 · `npm run lint` 0 errors (2 warnings pré-existentes: W3 unused eslint-disable em `flirt-ai-shell.tsx:448`, W4 stub `meta-graph-client.ts:17`) · `npm run build` standalone **28 rotas** (era 25 em W5 → +3 em W6: `/me`, `/me/onboarding`, `/api/me/profile`, `/api/me/profile/feedback`, `/api/me/profile/onboarding`).

---

## O que NÃO funciona / Bloqueadores

- [ ] **Migration não aplicada em DB local** — `docker compose up -d` falhou porque o host não tem `docker` instalado (`command not found: docker`). Migration SQL é válido (sintaxe checada via Prisma format/validate) e roda automaticamente em prod via `npx prisma migrate deploy && node server.js` (Dockerfile L125). **Impacto:** smoke E2E real só pode rodar quando Postgres estiver disponível. Owner: Meres (instalar Docker ou subir Postgres standalone). **Workaround pra dev local:** Postgres standalone via brew (`brew install postgresql@16`) ou Postgres.app.
- [ ] **Validação Langfuse do me-context cache hit não rodada** — gate análogo ao W5/coachTone: precisa key Langfuse + 1 call de coach autenticada após `/me` preenchido pra verificar `cache_read_input_tokens > 0` no segundo bloco do system. Owner: Meres. Impacto: medium (estrutura está certa — 2 blocos cached separados, Anthropic suporta isso oficialmente).
- [ ] **Classificador Haiku adiado pra W8** — decisão consciente da Wave 6: feedback negativo grava raw em `redPatternsRaw`, W8 (`WeeklyDigest`) processa em padrões consolidados via Sonnet sobre janela semanal. UI já avisa no `/me` ("Consolidação automática em release futura"). Não é blocker — `me-context` lida graciosamente com cenário de só `redPatternsRaw` populado.

---

## Smoke E2E (critérios testáveis)

> Pré-requisito: Postgres rodando + migration aplicada. Login válido em better-auth.

- [ ] **Critério 1 — Onboarding modal auto-abre pós-signup:** Limpar `sessionStorage`. Login fresh em conta nova → shell carrega → modal abre automaticamente em <1s com "Conta sobre você" + barra de progresso "Passo 1 de 6".
- [ ] **Critério 2 — Wizard avança 6 passos:** No modal, responder cada passo (ou pular). "Próximo" só avança se input válido (idade 14-120, kids 0-20). Último passo mostra "Concluir". Após Concluir → `POST /api/me/profile/onboarding` retorna 200 → modal fecha → não reabre no F5.
- [ ] **Critério 3 — Skip funciona:** Mesmo fluxo mas clicar "Pular tudo" no rodapé do wizard → POST com `{ skipped: true }` → `onboardingDone=true` no DB → modal fecha → banner CTA aparece no topo do chat.
- [ ] **Critério 4 — Banner CTA dismissable:** Clicar "Lembrar em 7 dias" → banner some + `localStorage.me-banner-dismissed-until` setado em now+7d. Recarregar página → banner não volta. Sobrescrever timestamp p/ now-1d em DevTools → banner volta na próxima reload.
- [ ] **Critério 5 — `/me` GET cria stub:** Conta nova nunca acessou `/me`. Abrir `/me` → request `GET /api/me/profile` retorna `userProfile: { tone: null, age: null, ..., winSamples: [], onboardingDone: false }`. DB agora tem row criada por upsert lazy.
- [ ] **Critério 6 — `/me` PATCH parcial:** Em `/me`, preencher apenas idade=27 + cidade="São Paulo" → "Salvar perfil" → `PATCH /api/me/profile { age: 27, locationCity: "São Paulo", contextLife: null, demographics: null, tone: null }` → 200 com userProfile atualizado. Outras chamadas PATCH só com alguns campos não devem zerar os anteriores (passou pela tela inteira).
- [ ] **Critério 7 — Feedback [Funcionou] grava winSample:** Mandar `/coach` numa conversa → assistant retorna ≥1 sugestão. Clicar `[Funcionou]` no card → POST `/api/me/profile/feedback { messageId, suggestionIndex: 0, rating: "worked" }` → 200. Em `/me`, abrir e verificar lista "O que funcionou pra você" contém o texto da sugestão.
- [ ] **Critério 8 — Feedback [Não rolou] grava redPatternsRaw:** Mesma sugestão, clicar `[Não rolou]` em outro card → POST com `rating: "didnt_work"` → 200. Em `/me`, seção "Padrões a evitar" mostra "1 feedback(s) negativo(s) registrado(s) — vão virar padrões consolidados em breve" (porque `redPatterns` consolidado ainda vazio).
- [ ] **Critério 9 — Coach injeta me-context:** Após preencher `/me` com idade+cidade+contextLife+tone, mandar próximo `/coach`. Em Langfuse (ou console.log temporário do `system: [...]`), verificar que `systemBlocks[1].text` começa com `Sobre o usuário (este homem é quem você está aconselhando):` + facts em PT-BR. `cache_control: ephemeral` deve estar setado em 2 blocos (`base` + `me-context`).
- [ ] **Critério 10 — Tone resolution funciona:** Setar `User.coachTone = "low_key"` via `/settings` E `UserProfile.tone = "provocador"` via `/me`. Próximo `/coach` deve injetar addendum "PROVOCADOR" (W6 override) — não "low-key". Confirmar em Langfuse ou logs.
- [ ] **Critério 11 — DELETE limpa mas preserva onboardingDone:** Em `/me`, clicar "Limpar memória" → confirm → DELETE retorna userProfile com arrays vazios + age/cidade/contexto null + `onboardingDone: true` (preservado). Modal de onboarding NÃO reabre na próxima sessão.
- [ ] **Critério 12 — Multi-tenant defense:** User A logado tenta `POST /api/me/profile/feedback` passando `messageId` que pertence a Contact do User B. Esperado: 404 ("Mensagem não encontrada") — Prisma filter `contact: { userId: A }` bloqueia.
- [ ] **Critério 13 — Rate limit feedback:** Disparar 121 POSTs em `/api/me/profile/feedback` em <1h. 121º retorna 429 com header `Retry-After`. (Rate limit dedicado pra `me-feedback`, não compartilha com `coach`.)
- [ ] **Critério 14 — Mobile-first onboarding:** Em viewport 320x568, modal abre em full-width, wizard ocupa quase tela toda, inputs ≥56px, "Pular tudo" e "Próximo" visíveis sem scroll, barra de progresso visível no topo.

---

## Done Criteria (do plano-mãe — ROADMAP.md W6)

- [x] **Schema-First obrigatório antes de codar** — `docs/DATA-MODEL.md` seção `UserProfile` adicionada antes do schema; `docs/COMPONENT-MAP.md` seção `Wave 6` cobre rotas/componentes/fluxos.
- [x] **Migration `create_user_profile`** — `prisma/migrations/20260525020000_create_user_profile/migration.sql`.
- [x] **Onboarding 6-perguntas (PT-BR, mobile-first) disparado no primeiro login pós-signup → preenche `UserProfile` initial. Skip-able com aviso "coach vai dar conselho genérico até você preencher"** — `<MeOnboardingModal>` auto-abre (sessionStorage-guarded), `<MeBannerCta>` persiste como aviso até preencher. Wizard mobile-first em `/me/onboarding`. Skip-able em qualquer passo + "Pular tudo" no rodapé.
- [x] **`lib/flirt/me-context.ts` — função `buildMeContext(userProfile)` retorna bloco string injetado no system prompt com `cache_control: ephemeral`** — `src/lib/flirt/me-context.ts` exporta `buildMeContext`; `/api/coach` adiciona como bloco com cache_control entre base e tone.
- [x] **Feedback loop: botão `[Funcionou] / [Não funcionou]` em cada `ReplySuggestion`** — `<SuggestionFeedback>` inline em cada SuggestionCard no shell.
- [x] **Positivo → texto entra em `UserProfile.winSamples`** — `POST /api/me/profile/feedback` com `rating: "worked"` faz append com dedup + cap 100.
- [x] **Negativo → ~~padrão extraído via classificador Haiku~~ raw entra em `redPatternsRaw`** — decisão Wave 6 (sem classificador), append com dedup + cap 200. Consolidação adiada pra W8 (WeeklyDigest).
- [x] **Endpoint `POST /api/me/profile/feedback`** — implementado com Zod + rate-limit dedicado + defesa multi-tenant.
- [x] **UI `/me` com visualização "o que o coach sabe", edição manual, botão "limpar memória" (LGPD)** — `src/app/me/page.tsx` cobre todos os 3 requisitos.
- [ ] **Onboarding completo em < 2min em mobile** — não medido (sem viewport real testado). Estimativa otimista: 30-60s pra preencher tudo, 5s pra skip. Validar manualmente quando smoke rodar.
- [ ] **System prompt do coach inclui bloco "sobre o usuário" verificado em Langfuse (com cache hit)** — código entrega; falta inspeção em sessão autenticada.
- [ ] **1 ciclo completo de feedback: suggestion → enviou → marcou funcionou → entrou em `winSamples` → próximo turn referencia** — implementado end-to-end no código; validar manualmente.
- [ ] **Nielsen H1-H10 PASS** — checklist documentado em COMPONENT-MAP W6 (1 FLAG: H10 tooltip explicando `redPatternsRaw`). Auditoria visual real fica pra Meres rodar com `nielsen-ui-auditor` ou manualmente.

---

## Guard-rails (avisos críticos pra próxima sessão)

- **Tone resolution é `userProfile?.tone ?? user.coachTone ?? null`** — `??` (nullish coalescing), não `||`. String vazia `""` nunca chega aqui porque o enum é `low_key | direto | provocador` (Zod garante). Mudar isso pode introduzir bug sutil onde `null` explícito em UserProfile.tone vira fallback pra User.coachTone (não-desejado).
- **`buildMeContext` retorna `null` quando o profile não tem nada útil** — caller (`/api/coach`) faz `if (meContextBlock)` antes de fazer push. Mudar a função pra retornar string vazia quebra a lógica e injeta bloco vazio no system (Anthropic vai retornar erro).
- **`cache_control: ephemeral` em 2 blocos é OK por design** — Anthropic SDK aceita múltiplos breakpoints de cache no array `system`. Cada `cache_control` cria um prefixo cached independente. Aqui o `base` é compartilhado entre TODOS os users (cache hit cross-user) e o `me-context` é per-user (cache hit por user). Tom NÃO leva cache_control de propósito (varia menos previsivelmente).
- **`winSamples` e `redPatternsRaw` têm cap defensivo (100/200) na rota** — não no schema. Se editar PATCH em outro lugar pra atualizar esses arrays direto, lembre de respeitar o cap; sem isso o prompt do coach inflará sem limite (cada item até 220 chars, 200 itens = ~44k chars = ~11k tokens pra um bloco só).
- **DELETE preserva `onboardingDone` de propósito** — evita reabrir o modal em loop pra user que limpou memória mas já viu o onboarding. Se um dia quiser "reset total", criar endpoint separado `DELETE /api/me/profile?hard=true` em vez de mudar o comportamento atual.
- **SuggestionCard agora é `<div>` com `<button>` interno + `<SuggestionFeedback>`** — antes era `<button>` único cobrindo tudo. Razão: nested buttons (feedback dentro de suggestion) violam HTML. Se reverter, perde a feature de feedback. Click-to-fill continua funcionando porque o button interno cobre 100% da área da sugestão.
- **`event.stopPropagation()` é obrigatório no wrapper do `<SuggestionFeedback>`** — sem isso, clicar nos botões de feedback dispara o `fillSuggestion` do botão pai (mesmo com refactor pra `<div>`, o focus do click pode chegar no botão interno). Os 2 botões dentro também têm stopPropagation por segurança.
- **`<MeBannerCta>` faz `GET /api/me/profile` em todo mount do shell** — request leve (Prisma findUnique + serialize), mas se virar bottleneck mover pro server (carregar em layout RSC e propagar via prop ao shell). Hoje é OK porque shell é o único consumer e mount é raro.
- **Sessão modal dismiss via sessionStorage NÃO sobrevive ao logout/login** — design: user que pulou no signup do morning vê modal de novo no signup do afternoon **se ainda não preencheu**. Quando `onboardingDone=true`, server simplesmente nunca dispara o modal independente do dismiss. Isso é correto.
- **Migration ainda não rodou em DB local** (docker faltando no host). Quando rodar pela 1ª vez (`npx prisma migrate deploy` no container start ou `prisma migrate dev` em dev local), confirmar que `user_profile` foi criada com defaults `'[]'` JSONB.
- **W5 ↔ W6 — não remover `User.coachTone`** — continua sendo o default global em `/settings`. `UserProfile.tone` é override fino. Os 2 coexistem por design.

---

## Próximas ações (W7 — Diário de Campo)

1. **Validar smoke W6 manualmente** (Meres): rodar os 14 critérios acima antes de abrir W7. Especialmente Langfuse pra confirmar 2 prefixos cached.
2. **Instalar Docker no host de dev** (ou rodar Postgres standalone) — destrava migrations locais. Continuar trabalho cego pode quebrar prisma generate em waves futuras se schema crescer.
3. **W7 vai querer integrar com `UserProfile.redPatterns`** — quando `EncounterLog` detecta padrão problemático recorrente do user (ex: "o homem repetiu padrão problemático" no ROADMAP W7), alimenta direto `redPatterns` consolidados (não `redPatternsRaw`). Definir a borda no schema do encounter-tool.
4. **Avaliar mover `<MeBannerCta>` pra layout RSC** — hoje cada mount do shell dispara fetch. Se virar bottleneck em prod, server-render no `app/layout.tsx` com `getSession` + propagar `initialOnboardingDone`. Não é urgente.
5. **Tooltip H10 — adicionar `<TooltipProvider>` na seção "Padrões a evitar" do `/me`** — fecha 1 FLAG Nielsen com 5min de trabalho. Pode entrar em qualquer wave futura.
6. **Test de regressão `coach-schema`** — adicionar 1 caso garantindo que `tone resolution` e `meContextBlock` opcional não quebram o pipeline existente. Cobertura barata.

---

## Achados durante execução (drifts, surpresas)

- **`Dialog` shadcn já suportava `showCloseButton`** — `src/components/ui/dialog.tsx:45` exporta a prop. Evitou refactor.
- **`SuggestionCard` original era `<button>` único cobrindo tudo** — primeira tentativa foi colocar `<SuggestionFeedback>` como sibling: HTML válido mas accidentalmente disparava fillSuggestion quando user clicava no feedback. Solução final: refactor pra `<div>` wrapper com `<button>` interno (click-to-fill) + `<SuggestionFeedback>` ao final (com stopPropagation defensivo).
- **`Prisma.DbNull` vs `null`** — bug clássico Wave 5 reapareceu: PATCH com `demographics: null` precisa converter pra `Prisma.DbNull` pra realmente nullificar JSON column (vs `null` que Prisma trata como "skip"). Padronizado no PATCH de `/api/me/profile` e `/api/me/profile/onboarding`.
- **Docker faltando bloqueou validação E2E local** — `prisma generate` rodou porque não precisa de DB, mas `prisma migrate dev` falhou (precisaria de DB ativo). Workaround: validei sintaxe SQL via `prisma format` + `prisma validate` + manualmente conferi shape vs schema. Migration deve rodar limpa em prod (formato idêntico aos migrations já aplicadas em waves anteriores).
- **`select` nested em Prisma findUnique pra User → userProfile** — funcionou de primeira via `userProfile: { select: { ... } }`. Antes de testar achei que precisaria do `include` (Prisma 7 endossa `select` aninhado oficialmente). Documentado pra próxima wave que precise de relations.
- **Lint react-hooks/exhaustive-deps em `MeBannerCta` e `MeOnboardingModal`** — usei pattern `let cancelled = false` + cleanup pra evitar setState após unmount. ESLint ficou feliz sem disable-comment porque `void load()` é chamada antes do return cleanup (cleanup só captura `cancelled`).
- **Cap de render do me-context (12 itens) é menor que cap de storage (100/200)** — diferença consciente: armazenamos histórico longo pra W8 processar; injetamos só os 12 mais recentes no system prompt pra não inflar token cost. Truncate 220 chars/item é o teto adicional.
