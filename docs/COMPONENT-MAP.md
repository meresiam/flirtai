# FlirtAI — COMPONENT-MAP

> Component-First. Mapa dos blocos da UI, estado local vs global, e onde cada coisa vive.

## Hierarquia (Atoms → Pages)

```
src/app/layout.tsx                          ← fonts + theme + global CSS
├── src/app/page.tsx                        ← Home (shell do chat)
│   └── src/components/flirt-ai-shell.tsx   ← <FlirtAiShell />  [client]
│       ├── <ConversationSidebar/>          ← lista de contatos + busca + nova conversa
│       │   └── <ContactCard/>              ← item da lista
│       ├── <ChatHeader/>                   ← avatar + name + status + tags do contato ativo
│       ├── <ChatMessages/>                 ← lista de mensagens (user/assistant)
│       │   ├── <UserBubble/>
│       │   └── <AssistantBubble/>
│       │       ├── <InsightChips/>         ← Interesse/Leitura/Mover/Evitar
│       │       └── <SuggestionCard/>       ← 4 tons, click → preenche input
│       ├── <EmptyState/>                   ← 3 prompts pré-prontos
│       ├── <ChatInput/>                    ← textarea + attach + command palette + send
│       │   ├── <CommandPalette/>           ← /nova /resposta /perfil /encontro
│       │   ├── <AttachmentChips/>          ← imagens em OCR processing
│       │   └── <TypingDots/>               ← indicador "Pensando"
│       └── <MobileDrawer/>                 ← sidebar como overlay em <lg
│
├── src/app/login/page.tsx                  ← email + senha
├── src/app/signup/page.tsx                 ← email + senha + nome
├── src/app/settings/page.tsx               ← Perfil · Conta (tz/locale) · Coach (tone) · Notificações · API & Modelo
├── src/app/desenrolos/page.tsx             ← lista de desenrolos + busca server-side com debounce 250ms
│
├── src/app/api/auth/[...all]/route.ts      ← better-auth handler
├── src/app/api/coach/route.ts              ← Anthropic Claude → JSON estruturado (consome user.coachTone)
├── src/app/api/contacts/route.ts           ← GET (lista, aceita ?q= + ?kind=) · POST (cria)
├── src/app/api/contacts/[id]/route.ts      ← GET · PATCH · DELETE
└── src/app/api/settings/route.ts           ← GET · PATCH (name, key, model, timezone, locale, coachTone, notificationPrefs)
```

> A UI atual tem TUDO inline em `flirt-ai-shell.tsx` (~1285 linhas). Não vamos quebrar em arquivos separados nessa entrega — refator visual seria retrabalho. Os subcomponents acima são lógicos, dentro do mesmo arquivo.

## Estado

### Local (useState dentro do shell)
- `value` — texto do input
- `attachments` — `Array<{ name, ocrText?, status }>` (W3)
- `isTyping` — request em voo
- `showCommandPalette` — palette aberta
- `activeSuggestion` — index navegação ↑↓
- `searchValue` — busca na sidebar
- `sidebarOpen` — drawer mobile
- `errorMessage` — erro da última call

### Global (Zustand — `src/store/use-flirt-store.ts`)
- `contacts: ContactRecord[]` — espelho do DB no client
- `selectedContactId: string`
- `hasHydrated: boolean` — flag de bootstrap (server-loaded)
- Actions: `selectContact`, `createContact`, `appendMessage`, `applyCoachResponse`, `setHasHydrated`
- Persist: localStorage v4 (versão sobe no W0.6 pra invalidar cache antigo sem userId)

### Server (sessão)
- `auth()` — `better-auth` retorna `{ user, session }` ou `null`
- `middleware.ts` redireciona `/` → `/login` se sem sessão

## Fluxos críticos

### 1. Login
```
/login → email + senha → POST /api/auth/sign-in/email
       → set cookie HttpOnly → redirect /
```

### 2. Bootstrap do shell
```
<FlirtAiShell/> mount
  → useEffect: fetch /api/contacts
  → set contacts no Zustand
  → setHasHydrated(true)
  → renderiza lista
```

### 3. Enviar mensagem
```
input → handleSendMessage()
  → parseCommand() detecta /nova /resposta /perfil /encontro
  → appendMessage local (optimistic)
  → POST /api/coach { contact, prompt, mode, history.slice(-8) }
  → coach route: rate limit check → Anthropic call → persiste Message → retorna JSON
  → applyCoachResponse(): atualiza contact + adiciona assistant bubble
  → scroll to bottom
```

### 4. OCR de imagem (W3)
```
attach image → useOcr(file) [tesseract.js worker]
  → status "lendo" no chip
  → texto extraído aparece como preview editável acima do input
  → user revisa → handleSendMessage envia o texto
```

## Naming Lock no front

| Tipo               | Convenção         |
|--------------------|-------------------|
| Componente         | PascalCase        |
| Hook               | camelCase `use*`  |
| Arquivo .tsx       | kebab-case        |
| Prop / state       | camelCase         |
| Tailwind class     | kebab-case        |

## Mobile-first (régua antes de fechar)

- Sidebar = drawer overlay no mobile (`lg:hidden`). ✅
- Touch targets ≥ 44px (botões circulares 40px na sidebar — ⚠️ verificar W4).
- Empty state cards quebram em coluna no mobile. ✅
- Command palette ocupa quase a largura inteira do input no mobile. ✅
- Input textarea autoresize com max 220px. ✅

## Nielsen — checklist H1-H10 a aplicar antes de fechar entrega (W4)

| # | Status atual | Pendente                                                 |
|---|--------------|----------------------------------------------------------|
| H1 | ✅ Loading + typing dots + toast erro      |                                                 |
| H2 | ✅ Copy em PT-BR direto                     |                                                 |
| H3 | ⚠️ Sem cancelar geração                     | "Parar" durante coach streaming (W3 opcional)    |
| H4 | ✅ shadcn + cor accent consistente          |                                                 |
| H5 | ⚠️ Sem confirmação ao deletar conversa      | Modal confirm ao deletar (W2 opcional)           |
| H6 | ✅ Comandos visíveis no rodapé              |                                                 |
| H7 | ✅ Atalhos: Enter envia, Shift+Enter quebra |                                                 |
| H8 | ✅ 1 CTA primário (Enviar)                  |                                                 |
| H9 | ⚠️ Erro 429/500 genérico                    | Mensagens específicas (rate limit, model 404)   |
| H10| ⚠️ Sem `/help` no agente                    | Comando `/help` lista atalhos (W3 opcional)      |

Critério de fechamento: zero BLOCK, ≤2 FLAGs justificadas. H3/H5/H10 ficam FLAG.

---

# Módulo: Profile Watch — COMPONENT-MAP

> UI + rotas de Profile Watch (Competitor / Influencer / Self-Coach). Vive em paralelo ao shell de chat, **não** dentro de `flirt-ai-shell.tsx`. Sidebar global do app ganha link novo `Perfis`.

## Hierarquia

```
src/app/profiles/
├── layout.tsx                          ← header com tabs (Todos · SELF · Competidores · Influencers)
├── page.tsx                            ← <ProfileListPage />  [client]
│   ├── <ProfileFilters />              ← tipo, status, search
│   └── <ProfileGrid />
│       └── <ProfileCard />             ← handle + avatar + último delta + chip de tipo
│
├── new/page.tsx                        ← <ProfileNewPage />   [client]
│   ├── <ProfileTypePicker />           ← cards: SELF (OAuth) / COMPETITOR / INFLUENCER
│   ├── <HandleStep />                  ← input `@handle` + valida público
│   ├── <ConsentDialog />               ← termo PT-BR + checkbox + versionado
│   └── <CadencePicker />               ← 12h / 24h / 48h / 7d
│
├── [id]/
│   ├── page.tsx                        ← <ProfileDetailPage />
│   │   ├── <ProfileHeader />           ← avatar + handle + métricas atuais + ações (pause/delete)
│   │   ├── <MetricDeltaRow />          ← seguidores / posts / engagement vs 7d atrás
│   │   ├── <ReportTimeline />          ← lista de ProfileReport, mais recente em cima
│   │   ├── <PostHistoryTable />        ← posts conhecidos (badge "deletado" quando isDeleted)
│   │   └── <CoachingPanel />           ← só renderiza se source=self
│   │       └── <SuggestionCard />      ← title + actionItems + botão ack
│   │
│   └── connect/page.tsx                ← <MetaOAuthRedirect /> (só source=self)
│
src/app/api/profiles/
├── route.ts                            ← GET (lista) · POST (cria, exige consent)
├── [id]/route.ts                       ← GET · PATCH (pause/resume/cadence) · DELETE
├── [id]/scan/route.ts                  ← POST (scan manual, rate-limited)
├── [id]/reports/route.ts               ← GET ?from=&to=
├── [id]/suggestions/route.ts           ← GET (só SELF) · PATCH (ack)
└── oauth/meta/
    ├── start/route.ts                  ← gera URL OAuth Meta
    └── callback/route.ts               ← recebe code, troca por token, salva no profile

src/app/api/cron/
└── profile-scan/route.ts               ← handler do cron, valida X-Cron-Secret
```

## Server-side (não vai pro client bundle)

```
src/lib/profile-watch/
├── apify-client.ts                     ← roda actor Instagram Profile Scraper
├── meta-graph-client.ts                ← Graph API IG Business
├── token-crypto.ts                     ← AES-GCM encrypt/decrypt p/ graphAccessToken
├── post-differ.ts                      ← diff novo vs anterior, marca deletados
├── report-builder.ts                   ← chama Anthropic com tool submit_profile_report
├── coaching-builder.ts                 ← chama Anthropic com tool submit_coaching_suggestions
├── consent-text.ts                     ← termos versionados
├── tools/
│   ├── report-tool-schema.ts           ← Tool definition Anthropic
│   └── coaching-tool-schema.ts
└── cron-runner.ts                      ← orquestrador chamado pela rota /api/cron/profile-scan
```

## Estado

### Local (useState por página)
- `ProfileListPage`: `filter`, `searchValue`, `selectedTab`
- `ProfileNewPage`: `step`, `selectedType`, `handle`, `cadenceHours`, `consentChecked`
- `ProfileDetailPage`: `selectedReportId`, `showPostHistory`

### Global (Zustand novo — `src/store/use-profiles-store.ts`)
Store separado do flirt-store. **Não mesclar** — domínio diferente, persist key diferente.

- `profiles: MonitoredProfileSummary[]`
- `selectedProfileId: string | null`
- Actions: `bootstrap()`, `addProfile(p)`, `removeProfile(id)`, `patchProfile(id, partial)`, `applyScan(id, snapshot, newPosts)`
- Persist: localStorage key `flirt-profiles-store`, version 1, skipHydration true

### Server (sessão)
Reusa `requireUser()` em todas as rotas `/api/profiles/*`. `/api/cron/profile-scan` NÃO usa sessão — valida `X-Cron-Secret`.

## Fluxos críticos

### 1. Cadastrar perfil COMPETITOR/INFLUENCER
```
/profiles/new
  → escolhe tipo COMPETITOR ou INFLUENCER
  → digita handle (sem @)
  → POST /api/profiles/validate { handle } → checa público via Apify quick-ping
  → ConsentDialog abre → user marca "li e aceito termos versão X"
  → POST /api/profiles { type, handle, cadenceHours, consentVersion }
    → DB cria MonitoredProfile com nextScanAt = NOW
    → response: profile criado
  → redirect /profiles/[id] (vazio, aguardando 1º scan)
```

### 2. Cadastrar perfil SELF (OAuth Meta)
```
/profiles/new → tipo SELF
  → POST /api/profiles/oauth/meta/start { intendedHandle? }
    → response { authUrl, state }
  → window.location = authUrl  (Meta OAuth)
  → user aceita scopes (instagram_business_basic)
  → callback Meta → /api/profiles/oauth/meta/callback?code=...&state=...
    → exchange code → long-lived token
    → fetch /me, /me/accounts → IG Business user id + handle
    → encrypt token (AES-GCM)
    → criar MonitoredProfile (source=self, graphAccessToken, graphUserId, consentAcceptedAt=now)
    → redirect /profiles/[id]
```

### 3. Cron de scan (background)
```
Scheduler externo → POST /api/cron/profile-scan + X-Cron-Secret
  → valida secret
  → busca até 50 MonitoredProfile vencidos
  → roda em paralelo limitado (p-limit ~5)
  → cada profile: cron-runner.run(profile)
       ├─ source=self → meta-graph-client
       └─ source≠self → apify-client
  → upsert snapshot + diff posts + marcar deletados
  → se janela de report fechou: report-builder → ProfileReport
  → se SELF + week boundary: coaching-builder → CoachingSuggestion[]
  → atualiza lastScanAt + nextScanAt
  → retorna 200 { processed, errors }
```

### 4. Ver relatório do dia
```
/profiles/[id]
  → GET /api/profiles/[id] (header + último snapshot + último report)
  → GET /api/profiles/[id]/reports?from=-7d (timeline)
  → render <ReportTimeline> + <MetricDeltaRow> + <PostHistoryTable>
  → se source=self: GET /api/profiles/[id]/suggestions → <CoachingPanel>
```

## Mobile-first do módulo

- `/profiles`: grid 1 col mobile → 2 col `md` → 3 col `lg`. Card touch target ≥ 56px.
- `/profiles/new`: stepper vertical. Cada step ocupa tela inteira no mobile.
- `/profiles/[id]`: header sticky, timeline em scroll vertical único. `<PostHistoryTable>` vira `<PostHistoryCards>` em `<md` (tabela quebra feio em mobile).
- `<ConsentDialog>`: full-screen sheet no mobile, modal no desktop.

## Nielsen checklist (Profile Watch)

| # | Critério                                    | Como cumprir aqui                                          |
|---|---------------------------------------------|------------------------------------------------------------|
| H1| Feedback em ≤200ms                          | Skeleton no grid + spinner no scan manual + toast pós-scan |
| H2| Linguagem do usuário                        | "Perfis monitorados", "Concorrente", "Relatório de hoje"   |
| H3| Cancelar/undo                               | Pause em vez de delete; delete pede confirm; undo pause    |
| H4| Consistência                                | Mesmos chips de status do shell de chat                    |
| H5| Prevenção                                   | Bloqueio de perfil privado antes de cadastrar              |
| H6| Reconhecimento                              | Cadência visível no card, não escondida em settings        |
| H7| Eficiência                                  | Bulk action: pausar/retomar N perfis selecionados          |
| H8| Minimalismo                                 | 1 CTA primário por página                                  |
| H9| Erros PT-BR                                 | "Perfil privado — não dá pra monitorar", "Token expirado — reconecte Meta" |
| H10| Ajuda                                      | Tooltip explicando "cadência" no picker                    |

## Variáveis sensíveis

`graphAccessToken` é encriptado em repouso via AES-256-GCM com chave em `BETTER_AUTH_SECRET` (já existe, reaproveita). **Nunca** retornar o token em response — apenas flag `hasValidToken`.

---

# Wave 5 — Settings & Search (24-05-2026)

## Settings expandido

Rota `/settings` (mesmo arquivo, refatorado para múltiplas sections). Cada section é um `<SectionCard>` com ícone Lucide + título + descrição opcional, todas com `min-h-[44px]` em CTAs/inputs (MOBILE-FIRST M2).

| Section          | Source state                            | Persistência                                 |
|------------------|-----------------------------------------|----------------------------------------------|
| Perfil           | `name`                                  | `PATCH /api/settings { name }`               |
| Conta            | `timezone`, `locale`                    | `PATCH /api/settings { timezone, locale }`   |
| Coach            | `coachTone` (radio low_key/direto/provocador) | `PATCH /api/settings { coachTone }` — salva on-change, sem botão (H1 feedback imediato) |
| Notificações     | `pushEnabled`, `frequency`              | `PATCH /api/settings { notificationPrefs }`  |
| Anthropic API    | `apiKey`, `model`                       | `PATCH /api/settings { anthropicApiKey, anthropicModel }` |

`coachTone` é consumido em `src/app/api/coach/route.ts` (load do user) → passado como 2º arg de `buildSystemPrompt(mode, tone)` em `src/lib/flirt/system-prompt.ts`. Quando null, voz default (sem addendum).

## Search server-side

`/desenrolos` lista:

```
input (controlled)
  → debounce 250ms (window.setTimeout + cleanup)
  → se trimmed.length >= 2: AbortController + fetch /api/contacts?kind=desenrolo&q=...
  → setServerResults(results) ou setSearchError(msg)
  → render desenrolos = hasActiveSearch ? serverResults : cachedContacts
```

Cache local do Zustand é preservado pra revisita rápida (no-query). Server-side cobre `name`, `instagramHandle`, `location`, `metContext` (ilike case-insensitive) + `tags` (match exato via `has`). `pg_trgm` não foi habilitado — EXPLAIN ANALYZE em 8 rows leva 0.1ms; extrapolando pra 500 rows seq scan fica ~7ms (gate <100ms cumprido). Adicionar `pg_trgm` + GIN index quando passar de ~10k rows por user.

## Naming Lock (W5)

- `CoachTone` enum no schema = `low_key | direto | provocador` (snake_case DB + TS).
- Frontend UI label: `Low-key | Direto | Provocador`.
- API contract camelCase: `coachTone`, `notificationPrefs`, `timezone`, `locale`.

---

# Wave 6 — Memória do Homem (24-05-2026)

## Visão

Coach deixa de dar conselho genérico. Cada turno do `/api/coach` injeta um bloco "sobre o usuário" no system prompt (com `cache_control: ephemeral`, batch separado do tone). 3 pontos de entrada: **modal pós-signup**, **banner CTA persistente no shell**, **página `/me`** dedicada.

## Hierarquia

```
src/app/me/
├── page.tsx                            ← <MePage />  [client]
│   ├── <MeHeader />                    ← título + descrição + "limpar memória"
│   ├── <MeForm />                      ← edita tone/age/locationCity/contextLife/demographics
│   ├── <MeWinSamplesList />            ← lista winSamples (read-only, com "remover")
│   └── <MeRedPatternsList />           ← lista redPatterns + redPatternsRaw (read-only)
│
└── onboarding/
    └── page.tsx                        ← <OnboardingPage /> wizard 6-passos full-screen, mobile-first

src/components/
├── me-onboarding-modal.tsx             ← <MeOnboardingModal /> [client]
│   - Mesma lib de wizard que /me/onboarding (compartilha steps).
│   - Auto-abre quando `user.userProfile.onboardingDone === false` e cookie `me-onboarding-dismissed` ausente.
│   - Botão "Pular por enquanto" seta cookie e fecha; banner CTA aparece em seguida.
│
├── me-banner-cta.tsx                   ← <MeBannerCta /> [client]
│   - Renderiza no topo do <FlirtAiShell /> quando onboardingDone=false.
│   - Copy: "Conta sobre você pro coach parar de chutar." → link /me/onboarding.
│   - Dismissable (cookie 7d): some por 1 semana, volta depois.
│
└── flirt-ai-shell.tsx                  ← (mod W6)
    ├── <AssistantBubble />
    │   └── <SuggestionCard />
    │       └── <SuggestionFeedback />  ← [Funcionou] / [Não funcionou] inline (W6)
    └── <MeBannerCta />                 ← topo do shell

src/lib/flirt/
└── me-context.ts                       ← buildMeContext(userProfile, user) → string
                                          (injetado no system prompt do /api/coach)

src/app/api/me/
├── profile/
│   ├── route.ts                        ← GET (lê) · PATCH (atualiza) · DELETE (limpa memória LGPD)
│   ├── feedback/route.ts               ← POST (registra winSample ou redPatternRaw, sem LLM)
│   └── onboarding/route.ts             ← POST (recebe payload do wizard, seta onboardingDone=true)
```

## Estado

### Local (useState)
- `MePage`: campos do form (tone, age, locationCity, contextLife, demographics)
- `MeOnboardingModal` / `OnboardingPage`: `step` (0-5), `answers` accumulator
- `MeBannerCta`: `dismissed` (cookie-based)
- `SuggestionFeedback`: `status` (`idle`, `sending`, `sent`, `error`), `rating` (`worked`, `didnt_work`, `null`)

### Global (Zustand)
Mantém-se simples: nada novo no `use-flirt-store.ts` por enquanto. `UserProfile` é fetch-on-mount em `/me` e estatuto `onboardingDone` é hidratado via cookie HttpOnly setado pelo server na rota `/me/onboarding` POST. Reavaliar em W8 se virar payload grande.

### Server (route handlers)
- `GET /api/me/profile` → retorna `{ userProfile, defaults }`. Cria stub `{}` se ainda não existir (upsert lazy).
- `PATCH /api/me/profile` → Zod parse → update parcial. Retorna patch aplicado.
- `DELETE /api/me/profile` → zera arrays (`winSamples`, `redPatternsRaw`, `redPatterns`) + nullifica age/location/context/demographics. **Não deleta a row** (preserva `onboardingDone`).
- `POST /api/me/profile/feedback` → `{ messageId, suggestionIndex, rating: "worked" | "didnt_work" }`. Lê texto da sugestão via `Message.suggestions[suggestionIndex].text`, append em `winSamples` ou `redPatternsRaw` (cap 100/200, drop oldest). 1 row do `UsageLog` por feedback pra rate-limit (`route=me-feedback`).
- `POST /api/me/profile/onboarding` → recebe `{ age?, locationCity?, contextLife?, demographics?, tone? }`, seta `onboardingDone=true`. Idempotente (chamar 2x atualiza, não duplica).

## Fluxos críticos

### 1. Pós-signup → onboarding
```
/signup completa → POST /api/auth/sign-up/email → redirect /
  → <FlirtAiShell /> mount
  → fetch /api/me/profile → onboardingDone=false (stub criado lazy)
  → <MeOnboardingModal /> auto-abre
  → user preenche 1-6 passos OU clica "Pular"
    → POST /api/me/profile/onboarding { ...answers } → onboardingDone=true
    → modal fecha
  → se "Pular" → cookie me-onboarding-dismissed=1 (24h) + banner CTA persiste
```

### 2. Coach turn com Memória do Homem
```
POST /api/coach { contactId, prompt, mode }
  → load(user) inclui userProfile (1-1 nested)
  → buildSystemPromptParts(mode, effectiveTone)
    onde effectiveTone = userProfile?.tone ?? user.coachTone ?? null
  → buildMeContext(userProfile) → bloco "Sobre o usuário" string
  → systemBlocks: [
      { text: base, cache_control: ephemeral },           ← Wave 0/1 cache hit
      meContextBlock ? { text: meContext, cache_control: ephemeral } : null, ← W6 cache hit
      toneAddendum ? { text: toneAddendum } : null,
    ]
  → resto idêntico ao W2 (streaming + tool_use + persist)
```

### 3. Feedback inline
```
user vê <SuggestionCard /> → clica [Funcionou]
  → optimistic: setRating("worked"), setStatus("sending")
  → POST /api/me/profile/feedback { messageId, suggestionIndex, rating: "worked" }
    → server lê Message.suggestions[suggestionIndex].text
    → upsert UserProfile.winSamples = append(text, cap 100)
    → 200 { ok: true }
  → setStatus("sent") → micro-confirmação visual (check + "guardado")
  → erro → setStatus("error") → toast + reset rating
```

### 4. Limpar memória (LGPD)
```
/me → "Limpar memória" → confirm dialog ("Isso apaga tudo que o coach guardou sobre você. Não tem volta.")
  → DELETE /api/me/profile → zera arrays + nullifica campos
  → 200 → reload local state, mostra empty state
  → onboardingDone permanece (pra não forçar wizard de novo a menos que user queira)
```

## Mobile-first do módulo (régua antes de fechar)

- Modal onboarding: `Sheet` full-screen no mobile (`<sm`). 1 pergunta por tela, próximo via swipe ou CTA grande.
- Cada step: input gigante (mín 56px), copy curta, "Pular" sempre visível (rodapé).
- `/me` page: stack vertical. Cada section card ≥56px touch target. Form em coluna única.
- Banner CTA: 1 linha mobile (`text-xs`), 2 linhas desktop. Toque em qualquer lugar abre `/me/onboarding`.
- Feedback buttons: tamanho 40px (mínimo viável pra inline em SuggestionCard). Cumprem H7 atalhos.

## Nielsen checklist W6 (a aplicar antes de fechar)

| # | Critério                                | Como cumprir aqui                                                |
|---|-----------------------------------------|------------------------------------------------------------------|
| H1| Feedback ≤200ms                         | Optimistic + check sutil em SuggestionFeedback; spinner no /me   |
| H2| Linguagem do usuário                    | "Sobre você", "O que funcionou", "Padrões a evitar" — não jargão |
| H3| Cancelar/undo                           | Onboarding "Voltar" entre steps; DELETE /me com confirm dialog   |
| H4| Consistência                            | Reusa `<SectionCard>`/`<Field>`/`<PrimaryButton>` do /settings   |
| H5| Prevenção                               | DELETE pede confirm; campos opcionais; sem validação intrusiva   |
| H6| Reconhecimento                          | /me mostra "o que o coach sabe" em texto direto, sem código      |
| H7| Eficiência                              | Atalho ↑↓ nos steps do modal; ENTER avança; cookie skip 7d       |
| H8| Minimalismo                             | 1 pergunta por step; 1 CTA primário por section em /me           |
| H9| Erros PT-BR                             | "Esse campo é opcional, segue em frente"; toast PT em feedback   |
| H10| Ajuda                                  | Tooltip "?" em `redPatternsRaw` explica "será processado depois" |

Critério: zero BLOCK, ≤2 FLAGs (H10 fica FLAG no MVP — tooltip pode ficar pra W8).

## Naming Lock (W6)

- `UserProfile` modelo TS · tabela DB `user_profile` (snake_case).
- Coluna DB: `user_id`, `location_city`, `context_life`, `win_samples`, `red_patterns_raw`, `red_patterns`, `onboarding_done`.
- Campo TS: `locationCity`, `contextLife`, `winSamples`, `redPatternsRaw`, `redPatterns`, `onboardingDone`.
- Frontend label: "Cidade", "Contexto de vida", "O que funcionou pra você", "Padrões a evitar".
- API contract: `userProfile` (nested), `effectiveTone` (server-only, não exposto).
