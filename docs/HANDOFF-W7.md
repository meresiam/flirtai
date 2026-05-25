---
alias: HANDOFF-W7-flirtai
type: handoff
status: done
tags: [flirtai, wave/W7, handoff, diario-de-campo, encounter-log, tool-use, anthropic]
date_e_hora: 25-05-2026
priority: high
projeto: flirtai
documento: HANDOFF-W7
wave: W7 — Diário de Campo (EncounterLog)
versao: 1.0
fechada_em: 25-05-2026
proxima_wave: W8 — Painel Status do Jogo (dashboard + WeeklyDigest)
mci_versao: v7.7
---

# HANDOFF — Wave 7 (Diário de Campo)

## Status

- Wave: W7 — Diário de Campo (EncounterLog)
- Período: 25-05-2026 → 25-05-2026
- Branch: master
- Resultado: ENTREGUE — build verde (29 rotas, +1 vs W6), typecheck verde, lint limpo (2 warnings pré-existentes mantidos).

Arquivos modificados/criados (todos W7):

| Arquivo | Tipo |
|---|---|
| `prisma/schema.prisma` | + model `EncounterLog` + relation `Contact.encounters` |
| `prisma/migrations/20260525030000_create_encounter_log/migration.sql` | CREATE TABLE `encounter_log` + INDEX `(contact_id, happened_at DESC)` + FK CASCADE |
| `docs/DATA-MODEL.md` | seção `EncounterLog` (entidade + shape extracted + decisão degraded) + migration history row |
| `docs/COMPONENT-MAP.md` | seção `Wave 7 — Diário de Campo` (hierarquia + fluxos + Nielsen + naming lock) |
| `docs/ROADMAP.md` | W7 marcado ✅ DONE — 25-05-2026, versao 1.3 |
| `src/types/flirt.ts` | + `EncounterEscalation`, `EncounterMood`, `EncounterAttractionDelta`, `EncounterExtractPayload`, `EncounterRecord` |
| `src/lib/flirt/encounter-schema.ts` | nova — `submit_encounter_extract` Anthropic Tool + zod runtime parser + 3 enums (escalation/mood/attractionDelta) |
| `src/app/api/contacts/[id]/encounters/route.ts` | nova — POST (insert raw → call LLM extract sync → update Contact + UserProfile em $transaction) · GET (paginado por cursor `happenedAt,id` DESC) |
| `src/components/encounter/encounter-capture-modal.tsx` | nova — Dialog full-screen mobile, textarea + datetime-local, ⌘+Enter envia, mostra aviso degraded inline |
| `src/components/encounter/encounter-card.tsx` | nova — card timeline com escalation/mood chips, green/red flags, nextMove destacado, userRedPatterns em âmbar, details "Ver relato bruto" colapsável |
| `src/components/encounter/encounter-timeline.tsx` | nova — wrapper de lista + estados loading/empty/error + paginação "Carregar mais" |
| `src/app/desenrolos/[id]/page.tsx` | + botão "+ Como foi?" no header sticky · seção `Diário de campo` com timeline · fetch on-mount paginado · `submitEncounter` callback usado pelo modal · refresh do Zustand após POST pra propagar flags atualizadas |

---

## O que funciona (entregue + validado)

- [x] **Schema-First completo** — `EncounterLog` em `prisma/schema.prisma` antes de qualquer código; `docs/DATA-MODEL.md` seção entidade + shape do `extracted` + migration history row atualizada; `docs/COMPONENT-MAP.md` seção Wave 7 com hierarquia/fluxos/Nielsen/naming lock.
- [x] **Migration SQL** — CREATE TABLE `encounter_log` (PK `id` cuid, FK `contact_id` CASCADE pra `contact`, `happened_at` TIMESTAMP NOT NULL, `raw_text` TEXT NOT NULL, `extracted` JSONB NOT NULL, `created_at` TIMESTAMP default CURRENT_TIMESTAMP) + INDEX `(contact_id, happened_at DESC)`. Validada via `npx prisma format` + `npx prisma validate` + `npx prisma generate` (client v7.8.0 ok). **Não aplicada em DB local** (mesma situação W6 — docker não está no host); rodará no próximo `prisma migrate deploy` do container Coolify.
- [x] **Tool schema `submit_encounter_extract`** — `src/lib/flirt/encounter-schema.ts` exporta o `Anthropic.Tool` definition + `encounterExtractSchema` (zod) com 3 enums canônicos: `escalation` (`regrediu|estagnou|avancou|indefinido`), `mood` (`leve|tenso|intenso|frustrante|neutro`), `attractionDelta` (`down|same|up`). Constantes exportadas (`ESCALATION_VALUES` etc) garantem 1 fonte de verdade pro schema e pra serialização.
- [x] **`POST /api/contacts/[id]/encounters`** — multi-tenant: `requireUser()` + `Contact` filtrada por `userId` → 404 se não-dono. Zod parse (`rawText` 5-4000 chars, `happenedAt` ISO opcional). Rate limit dedicado `encounters` 60/h. **Insert raw SEMPRE primeiro** (preserva dado do user mesmo se LLM falhar) com fallback degraded; depois call Anthropic `submit_encounter_extract` síncrona; se sucesso, `$transaction` atualiza `EncounterLog.extracted` + `Contact.{greenFlags,redFlags,lastInteractionSummary,attractionLevel}` + (se `userRedPatterns.length>0`) `UserProfile.redPatterns`. Reusa `decryptToken` pra per-user key + fallback `process.env.ANTHROPIC_API_KEY`.
- [x] **`GET /api/contacts/[id]/encounters`** — cursor estável `(happenedAt, id)` DESC. Default 20, max 50. `?before={lastId}` pra paginar. Retorna `{ encounters[], nextCursor }`.
- [x] **Integração W6 — Memória do Homem** — quando `extracted.userRedPatterns.length > 0`, append em `UserProfile.redPatterns` (cap 200 via `RED_PATTERNS_RAW_DB_CAP`, dedup). Vai pro array **consolidado** (`redPatterns`), não pro raw — sinalizando que veio de evidência factual (encounter) e não de feedback impulsivo. `buildMeContext` (W6) lê esse array → injeta no system prompt do `/api/coach` no próximo turn → coach passa a saber dos padrões do homem.
- [x] **Attraction shift** — `shiftAttraction(current, delta)` clamp ordenado `["Low", "Medium", "High"]`. `up` no `High` mantém High; `down` no `Low` mantém Low; `same` no-op.
- [x] **Flags merge dedup** — `mergeDedupCap` preserva ordem, dedup por igualdade exata, cap 12 itens (FIFO drop dos mais antigos). Aplica em `greenFlags` e `redFlags` do `Contact`.
- [x] **Degraded mode (graceful)** — qualquer falha do LLM (sem API key, sem tool_use no response, schema inválido, exception SDK) NÃO derruba o request. `EncounterLog.extracted` mantém fallback mínimo (`degraded: true`) + raw já gravado + 200 com `degraded: true` + `degradedReason` opcional. UI mostra banner amarelo "Texto guardado. IA não conseguiu ler agora". Encounters degraded ainda aparecem na timeline (card mostra aviso âmbar + raw preservado em `<details>`).
- [x] **Modal de captura** (`<EncounterCaptureModal />`) — Dialog shadcn full-screen mobile-first (`max-w-2xl`, `max-h-[92vh]`, scroll interno). Header "Como foi com {nome}?" + textarea 200px mín + datetime-local default=now. Validação inline (mín 5 chars, data não-futura, char counter). Atalho ⌘+Enter envia. Foco automático no textarea ao abrir (H7). Botão "Salvar encontro" 44px touch target.
- [x] **Timeline** (`<EncounterTimeline />`) — estado loading com spinner, empty state PT-BR com CTA, error state em rosa, paginação "Carregar mais" quando `nextCursor != null`.
- [x] **Card** (`<EncounterCard />`) — header com data formatada PT-BR (`Intl.DateTimeFormat`) + chips de escalation (ícone trending up/down/minus/help) + mood (cor por mood). Summary destacado, flags em 2 colunas (green emerald / red rose). NextMove em bloco com borda esquerda `#ff355d`. UserRedPatterns em bloco âmbar próprio. `<details>` colapsável pro raw text.
- [x] **Refresh do Contact pós-submit** — `submitEncounter` chama `bootstrap()` do Zustand após POST sucesso, garantindo que `greenFlags/redFlags/attractionLevel/lastInteractionSummary` atualizem na home e na lista de desenrolos sem precisar de F5.
- [x] **Build gates verdes** — `npx tsc --noEmit` exit 0 · `npm run lint` 0 errors (2 warnings pré-existentes: W3 unused eslint-disable em `flirt-ai-shell.tsx:448`, W4 stub `meta-graph-client.ts:17`) · `npm run build` standalone **29 rotas** (era 28 em W6 → +1 em W7: `/api/contacts/[id]/encounters`).

---

## O que NÃO funciona / Bloqueadores

- [ ] **Migration não aplicada em DB local** — `docker compose up -d` falha por falta de docker no host (mesma situação herdada de W6). Migration SQL validada via Prisma format/validate + visualmente conferida vs schema. Roda automaticamente em prod via `npx prisma migrate deploy && node server.js` (Dockerfile L125). **Impacto:** smoke E2E real só pode rodar quando Postgres estiver disponível. Owner: Meres.
- [ ] **Smoke E2E real não rodado** — depende DB rodando + login válido + `ANTHROPIC_API_KEY`. Critérios estão escritos abaixo, mas não executados. Estimativa: 15-20min de validação manual pelo Meres na 1ª sessão pós-deploy.
- [ ] **Sem delete de encounter** — decisão MVP. Se um relato for criado por engano, o user pode editar manualmente abrindo o `details` e... não tem como editar. **FLAG Nielsen H3**: aceitável no MVP porque encounters são append-only por design (timeline cronológica imutável). Caso vire bug em produção, adicionar `DELETE /api/contacts/:id/encounters/:encounterId` + ícone trash no card.
- [ ] **Tooltip H10 ausente no botão "+ Como foi?"** — FLAG no checklist Nielsen (aceitável, fix < 10min em qualquer wave futura).
- [ ] **Sem rolling summary de encounters no coach** — hoje `/api/coach` não vê o histórico de encontros. Decisão W7: integração via `Contact.lastInteractionSummary` (que JÁ é atualizado por cada encounter) + `UserProfile.redPatterns` (alimentado por `userRedPatterns`). Pode evoluir em W8 (incluir últimos 3 encounters no contexto do coach).

---

## Smoke E2E (critérios testáveis)

> Pré-requisito: Postgres rodando + migration `20260525030000_create_encounter_log` aplicada. `ANTHROPIC_API_KEY` configurada (server ou /settings). Login válido + 1 contato existente com mensagens.

- [ ] **Critério 1 — Botão "+ Como foi?" visível**: Abrir `/desenrolos/[id]` de um contato qualquer. Header sticky mostra "Como foi?" entre "Editar" e "Abrir chat". Também há "Novo encontro" na seção "Diário de campo" abaixo do read view.
- [ ] **Critério 2 — Empty state**: Em contato novo sem encounters, seção "Diário de campo" exibe card dashed "Nenhum encontro registrado ainda. Use o botão + Como foi? depois de um rolê..."
- [ ] **Critério 3 — Modal abre + foca textarea**: Clicar "+ Como foi?" → Dialog abre em <200ms. Foco vai pro textarea automaticamente. datetime-local pré-preenchido com data/hora atual local.
- [ ] **Critério 4 — Validação mín 5 chars**: Digitar 3 chars → "Salvar encontro" fica disabled, char counter mostra "3/4000 caracteres · mínimo 5" em âmbar.
- [ ] **Critério 5 — Validação data futura**: Tentar data 1h no futuro → "Salvar encontro" → erro inline "Data do encontro não pode ser no futuro."
- [ ] **Critério 6 — Submit feliz**: Texto 200 chars realistas (ex: "Fui no jantar com a Bia ontem. Ela tava super à vontade, riu muito, me convidou pra um drink depois. Disse que tava cansada do trabalho mas que adorou sair comigo."). Salvar → spinner em <200ms → modal fecha → toast/refresh visual. Timeline mostra novo card no topo com summary + ≥3 sinais (greenFlags ≥ 1 + escalation = "avancou" esperado + nextMove preenchido).
- [ ] **Critério 7 — Contact atualiza**: Após critério 6, voltar pra `/desenrolos` lista (ou home/chat) → `lastInteractionSummary` do contato mostra o novo summary. `attractionLevel` pode ter subido. `greenFlags` mostra ≥1 novo (visível em `/desenrolos/[id]` na seção que renderiza isso, se houver — senão validar via DB direto).
- [ ] **Critério 8 — Integração W6 redPatterns**: Texto com padrão do user (ex: "Mandei mensagem 4x sem ela responder e depois cobrei explicação. Ela mal respondeu."). Salvar → após sucesso, abrir `/me` → seção "Padrões a evitar" lista o novo padrão (ex: "insistência apesar de sinal claro de desinteresse"). Próximo turn em `/api/coach` (validar em Langfuse) inclui no system prompt o bloco "Padrões problemáticos detectados (evite repetir): - insistência..."
- [ ] **Critério 9 — Degraded mode**: Setar `ANTHROPIC_API_KEY` inválida ou parar a Anthropic. Submit encounter → modal mostra banner amarelo "Texto guardado. IA não conseguiu ler agora (...)". Botão muda pra "Fechar". Timeline mostra card com banner âmbar + raw text colapsável. **DB tem a row** com `extracted.degraded=true`.
- [ ] **Critério 10 — Multi-tenant defense**: User A logado tenta `POST /api/contacts/{contactIdDoUserB}/encounters`. Esperado: 404 "Contato não encontrado." Prisma filter `where: { id, userId: A }` bloqueia.
- [ ] **Critério 11 — Rate limit encounters**: Disparar 61 POSTs em <1h. 61º retorna 429 com header `Retry-After`. Rate limit dedicado `route="encounters"` (não compartilha com `coach` nem `me-feedback`).
- [ ] **Critério 12 — Cursor pagination**: Criar 25 encounters em 1 contato. GET sem cursor retorna 20 + `nextCursor != null`. GET `?before={nextCursor}` retorna últimos 5 + `nextCursor: null`.
- [ ] **Critério 13 — Mobile-first**: Em viewport 320x568, modal abre full-width (`w-[95vw]`), textarea ocupa pelo menos 200px de altura, datetime-local + textarea + botão "Salvar" todos com touch target ≥44px. Sem scroll horizontal.
- [ ] **Critério 14 — ⌘+Enter atalho**: No modal, com foco no textarea, ⌘+Enter (ou Ctrl+Enter no Linux/Win) submete sem precisar do botão.

---

## Done Criteria (do plano-mãe — ROADMAP.md W7)

- [x] **Schema-First obrigatório antes de codar** — `docs/DATA-MODEL.md` seção `EncounterLog` adicionada antes do schema; `docs/COMPONENT-MAP.md` seção `Wave 7` cobre rotas/componentes/fluxos/Nielsen/naming lock.
- [x] **Migration `create_encounter_log`** — `prisma/migrations/20260525030000_create_encounter_log/migration.sql`.
- [x] **UI: botão `[+ Como foi?]` no card do contato em `desenrolos/[id]/page.tsx`** — botão sticky no header + segundo CTA "Novo encontro" na seção da timeline.
- [x] **Modal de captura — textarea grande, livre. PT-BR.** — `<EncounterCaptureModal />` com textarea 200px mín, copy PT-BR ("Conta como foi. Onde, como ela tava, o que rolou, o que tu sentiu. Sem filtro.").
- [x] **`POST /api/contacts/:id/encounters` (1) Grava raw** — insert sempre antes da call LLM.
- [x] **(2) Síncrono no MVP: call Anthropic com tool_use schema `extract_encounter` em `lib/flirt/encounter-schema.ts`** — implementado (nome final: `submit_encounter_extract`).
- [x] **(3) Atualiza `Contact.greenFlags`, `redFlags`, `lastInteractionSummary`, possivelmente `attractionLevel`** — todos os 4 campos atualizados em `$transaction`.
- [x] **(4) Se o homem repetiu padrão problemático → alimenta `UserProfile.redPatterns` (integração W6)** — quando `extracted.userRedPatterns.length > 0`, append em `UserProfile.redPatterns` (consolidados, não raw — sinaliza evidência factual de encounter).
- [x] **Timeline de encontros no `desenrolos/[id]/page.tsx` (cronológico desc)** — `<EncounterTimeline />` ordena por `happenedAt DESC, id DESC` (cursor estável), card visualiza tudo do extracted.
- [ ] **1 log com 200 caracteres extrai ≥3 sinais corretamente** — implementado, validação manual pendente (depende Anthropic real call + Langfuse pra inspeção).
- [ ] **Contato atualiza flags** — código aplica merge dedup cap 12; validação visual pendente.
- [ ] **Timeline aparece no perfil** — código entrega; testar visualmente após DB rodar.
- [ ] **Padrão recorrente do homem entra em `redPatterns`** — código aplica append dedup cap 200; testar com input que contém padrão claro do user.

---

## Guard-rails (avisos críticos pra próxima sessão)

- **`EncounterLog.extracted` SEMPRE tem shape válido** — se LLM falhar, `degraded: true` + fallback mínimo é gravado. Nunca null, nunca objeto vazio. Quem ler `extracted` no front (`normalizeExtract` ou direto) pode contar com os 8 campos sempre presentes.
- **Insert raw vem ANTES da call LLM** — decisão de design. Mesmo se LLM cair, o relato do user nunca é perdido. Se essa ordem inverter, perde dado em outage da Anthropic.
- **`mergeDedupCap` faz dedup por igualdade exata de string** — "Ela riu muito" e "ela riu muito" viram 2 itens diferentes. Aceitável no MVP; se virar bug, normalizar (lowercase + trim) antes do `Set.has`. NÃO mudar a função sem entender que `appendCapped` no `/api/me/profile/feedback` faz coisa parecida — manter consistência se evoluir.
- **`shiftAttraction` é clamp determinístico** — `attractionDelta: "up"` no `High` retorna `High` (não wrap, não erro). Mudar pra lançar erro quebra o degraded mode.
- **`extracted.userRedPatterns` alimenta `UserProfile.redPatterns` (consolidados)**, NÃO `redPatternsRaw`. Razão: feedback negativo do `/api/me/profile/feedback` vai pro raw (sinal impulsivo do user); encounter é evidência factual de comportamento. Manter essa distinção até W8 unificar com classificador.
- **Cursor de paginação usa `(happenedAt, id)` DESC** — tupla composta pra estabilidade. Se 2 encounters tiverem `happenedAt` idêntico (raro mas possível com import em batch), o tie-break por `id` evita loop ou skip. NÃO simplificar pra só `happenedAt`.
- **Modal mantém-se aberto quando `degraded=true`** — UX deliberada: user precisa VER o aviso antes de fechar. Caso reverta, perde a sinalização do erro silencioso.
- **Sem persist do encounters no Zustand** — fetch on-mount toda vez que abre `/desenrolos/[id]`. Razão: volume potencialmente alto + privacidade (texto pessoal sobre encontros). Se virar bottleneck em prod, mover pra RSC ou criar store separado com TTL curto.
- **`Contact.encounters` (relation) é definido mas NÃO usado em include nenhum** — encounters sempre carregados via query própria (paginada). Não acoplar a queries de Contact pra não inflar payload. Se algum dia precisar de `_count.encounters`, adicionar via `prisma.contact.findFirst({ ..., include: { _count: { select: { encounters: true } } } })`.
- **Migration não rodou em DB local** — quando rodar pela 1ª vez (`prisma migrate deploy` no container start), confirmar que `encounter_log` foi criada com `extracted JSONB NOT NULL` (NOT NULL é crítico — fallback degraded depende disso).
- **W6 ↔ W7 — não remover `redPatternsRaw`** — continua sendo usado por `/api/me/profile/feedback` (negative feedback impulsivo). W7 alimenta o array consolidado `redPatterns`. Os 2 coexistem por design.

---

## Próximas ações (W8 — Painel Status do Jogo)

1. **Validar smoke W7 manualmente** (Meres): rodar os 14 critérios acima quando Postgres estiver rodando. Especialmente o critério 8 (integração W6) e o 9 (degraded mode).
2. **Instalar Docker no host de dev** (ou Postgres standalone via brew/Postgres.app) — destrava migrations locais. Continua bloqueando smoke E2E real desde W6.
3. **W8 vai querer ler `EncounterLog`** — para o `WeeklyDigest`, agrega encounters da semana via `prisma.encounterLog.findMany({ where: { contact: { userId }, happenedAt: { gte: weekStart, lt: weekEnd } } })`. O extractor de digest pode reusar parte do contexto via `EncounterExtractPayload`.
4. **W8 vai precisar de uma agregação "cold leads"** — `status='active' AND (last_message OR last_encounter) < now() - 5d`. Usar `Contact.updatedAt` (que sobe a cada encounter via update do `Contact`) ou JOIN com max(`encounter_log.happened_at`). Decidir no início da W8.
5. **Considerar incluir últimos N encounters no contexto do `/api/coach`** — hoje o coach lê `Contact.lastInteractionSummary` (que é atualizado por cada encounter). Pode evoluir pra incluir os 3 encounters mais recentes + nextMove pra contexto mais rico. Custo: ~500-1500 tokens extras por turn (avaliar via Langfuse).
6. **Tooltip H10 no botão "Como foi?"** — fix 10min em qualquer wave. Reusa `<TooltipProvider>` do shadcn (já instalado).
7. **DELETE encounter** — se feedback dos users pedir, adicionar `DELETE /api/contacts/:id/encounters/:encounterId` + ícone no card. Manter append-only como default.

---

## Achados durante execução (drifts, surpresas)

- **Decisão "raw first, extract depois"** — não estava explícita no ROADMAP, surgiu durante implementação. Razão: a vontade de capturar dado bruto do user (com valor emocional alto — relato de encontro real) é mais forte que a vontade de extrair sinais perfeitos. Trade-off: schema do `extracted` precisa tolerar fallback (`degraded: true` + valores mínimos). Decisão registrada no DATA-MODEL.md como nota.
- **Nome do tool: `submit_encounter_extract` em vez de `extract_encounter`** — match com convenção W6 (`submit_flirt_response`) que usa verbo `submit_` pra tool_use forçado. Documentação atualizada.
- **`userRedPatterns` vai pra `redPatterns` (consolidados) e NÃO `redPatternsRaw`** — divergência consciente vs W6 feedback que vai pra raw. Razão: encounter é evidência factual de comportamento (user descreveu o que ele mesmo fez); feedback impulsivo de `[Não rolou]` é juízo subjetivo do user. Os 2 sinais merecem peso diferente no prompt — encounter ganha promoção direta pra consolidado.
- **Cursor stable `(happenedAt, id)` vs offset** — escolhido cursor por estabilidade sob inserts concorrentes (user salva encounter enquanto rolei a página = sem duplicar nem pular). Custo: 2 queries por GET com cursor (1 pra resolver o cursor row, 1 pra paginar). Aceitável; se virar hotspot, materializar `(happenedAt, id)` em string codificada base64 client-side.
- **`Intl.DateTimeFormat("pt-BR", ...)`** — escolhido em vez de import de date-fns pra evitar dependência nova. Bundle delta zero. Funciona em SSR + client (Node 22 tem Intl completo).
- **`<details>/<summary>` colapsável pro raw** — HTML nativo em vez de import de Collapsible. Acessível por padrão, anima sem CSS extra, zero JS.
- **`shiftAttraction` clamp ordenado** — usei array literal `["Low", "Medium", "High"]` em vez de enum de Prisma diretamente. Tipo casted via `PrismaAttractionLevel` import. Razão: Prisma 7 ainda exporta enums como string literals union, não como objeto enumerável — array literal é o jeito mais limpo de iterar.
- **`bootstrap()` chamado após submit do encounter** — força refresh dos contacts no Zustand pra propagar `greenFlags/redFlags/lastInteractionSummary/attractionLevel` atualizados. Custo: 1 GET extra `/api/contacts` por encounter salvo (não é hot path). Alternativa seria propagar via `data.contact` retornado, mas o Zustand action `applyEncounterResponse` não existe e criar agora seria over-engineering pra W7.
- **TS error inicial em `serializeEncounter`** — passei `extracted` dentro do objeto Prisma desconstruído (`{ ...encounter, extracted: ... }`) mas o tipo de `serializeEncounter` aceita `extracted` como SEGUNDO argumento, não como prop do row. Fix trivial removendo o spread + sobrescrever. Documentado pra próxima wave que precise serializar Json.
