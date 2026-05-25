# FlirtAI — DATA-MODEL

> Schema-First. Source of truth: `prisma/schema.prisma`. Tudo em snake_case no Postgres, camelCase via Prisma `@map`.

## Convenção de naming (Naming Lock)

| Camada       | Estilo      | Exemplo                  |
|--------------|-------------|--------------------------|
| Tabela DB    | snake_case  | `usage_log`              |
| Coluna DB    | snake_case  | `attraction_level`       |
| Modelo TS    | PascalCase  | `Contact`                |
| Campo TS     | camelCase   | `attractionLevel`        |
| Enum DB      | snake_case  | `hot_lead` (literal)     |
| Enum TS      | snake_case  | `hot_lead`               |

> **Wave 0 / C9 (24-05-2026):** o literal de DB era `'hot lead'` (com espaço) mapeado via Prisma `@map`; agora batem 1:1 entre TS e DB. Migration `20260524230000_rename_hot_lead_enum` aplica `ALTER TYPE "ContactStatus" RENAME VALUE 'hot lead' TO 'hot_lead'`.

## Entidades

### `User` (better-auth)
Pessoa logada. Multi-tenant por `userId`.

| Campo                       | Tipo         | Nota                                                                 |
|-----------------------------|--------------|----------------------------------------------------------------------|
| `id`                        | String PK    | cuid                                                                 |
| `email`                     | String       | UNIQUE                                                               |
| `emailVerified`             | Boolean      | default false                                                        |
| `name`                      | String?      |                                                                      |
| `image`                     | String?      |                                                                      |
| `anthropicApiKeyEncrypted`  | String?      | override per-user da API key — encriptado (ver nota abaixo)          |
| `anthropicModel`            | String?      | override per-user do model id (ex: `claude-sonnet-4-6`)              |
| `timezone`                  | String?      | IANA tz (ex: `America/Sao_Paulo`). W5 / M8.                          |
| `locale`                    | String?      | BCP47 (ex: `pt-BR`, `en-US`). W5 / M8.                               |
| `coachTone`                 | CoachTone?   | enum `low_key` · `direto` · `provocador`. W5 / M8.                   |
| `notificationPrefs`         | Json?        | `{ push: boolean, frequency: "instant"\|"daily"\|"weekly" }`. W5 / M8. |
| `createdAt`                 | DateTime     |                                                                      |
| `updatedAt`                 | DateTime     |                                                                      |

Relations: `sessions`, `accounts`, `contacts`, `usageLogs`, `monitoredProfiles`.

> **W1 / C2 (24-05-2026):** o campo `anthropicApiKey` (plaintext) foi substituído por `anthropicApiKeyEncrypted`. Armazenamento usa **AES-256-GCM** com chave derivada de `SHA-256(BETTER_AUTH_SECRET)` (32 bytes), formato `base64(iv(12) || ciphertext || tag(16))`. Reusa `src/lib/profile-watch/token-crypto.ts::encryptToken/decryptToken`. Migration `20260524240000_encrypt_anthropic_api_key` empacotou expand-contract em 1 passo porque o DB dev está vazio; em prod com dados reais splitar em 3 etapas (ADD encrypted → backfill → DROP plaintext).

> **W5 / M8 (24-05-2026):** 4 campos novos de preferência (`timezone`, `locale`, `coachTone`, `notificationPrefs`). Todos nullable — defaults aplicados na borda (route `/api/settings` + `buildSystemPrompt`). `coachTone` é consumido por `src/lib/flirt/system-prompt.ts::buildSystemPrompt(mode, tone?)` e injetado como bloco no system prompt do `/api/coach`. Quando `null`, o coach usa a voz default ("low-key" implícito). Migration `20260525011534_add_user_preferences` (ADD COLUMNs nullable + CREATE TYPE `CoachTone`, baixo risco — sem backfill).

### `UserProfile` (W6 — Memória do Homem)
Perfil persistente do **usuário** (o homem). Source de truth pra "o que o coach sabe sobre mim". 1-1 com `User`.

| Campo            | Tipo               | Nota                                                                  |
|------------------|--------------------|-----------------------------------------------------------------------|
| `userId`         | String PK / FK→User| 1-1, cascade delete                                                   |
| `tone`           | CoachTone?         | override fino do tom (W6). Prioridade: `UserProfile.tone > User.coachTone > null` |
| `age`            | Int?               | idade do homem                                                        |
| `locationCity`   | String?            | "São Paulo", "Lisboa", etc                                            |
| `contextLife`    | String?            | enum livre PT-BR: "universitário", "corporativo", "autônomo", "atleta", "criativo" |
| `demographics`   | Json?              | `{ relationship?: "solteiro"\|"divorciado"\|"casado", kids?: number }` opcional |
| `winSamples`     | Json               | `string[]` — textos de sugestões marcadas como `[Funcionou]`. Cap 100 |
| `redPatternsRaw` | Json               | `string[]` — feedbacks negativos raw (`[Não funcionou]`). Cap 200. W8 processa em padrões |
| `redPatterns`    | Json               | `string[]` — padrões problemáticos consolidados (vazio até W8 rodar)  |
| `onboardingDone` | Boolean            | default false. True após preencher o wizard 6-perguntas               |
| `createdAt`      | DateTime           |                                                                       |
| `updatedAt`      | DateTime           | @updatedAt                                                            |

Relations: `user` (1-1).
Index: PK em `userId` é suficiente.

> **W6 (24-05-2026):** introduz a "Memória do Homem". Schema desenhado pra ser **append-only** nos arrays (`winSamples`/`redPatternsRaw`) com cap defensivo (100/200) — sem cap, prompt do coach inflaria sem limite. O classificador Haiku previsto no ROADMAP foi adiado: feedback negativo grava raw e `WeeklyDigest` (W8) consolida em `redPatterns`. Migration `20260525020000_create_user_profile`.

> **Tone resolution:** `/api/coach` resolve em runtime via `effectiveTone = userProfile?.tone ?? user.coachTone ?? null`. UserProfile.tone é o override fino (W6); User.coachTone (W5) continua sendo o default global em `/settings`. Sem retrocompatibilidade necessária — W5 funciona se UserProfile.tone for null (caso de qualquer user pre-W6).

### `EncounterLog` (W7 — Diário de Campo)
Captura pós-encontro de um `Contact`. Texto cru (livre, PT-BR) + JSON extraído via LLM com sinais estruturados. Alimenta o coach (atualiza `Contact.greenFlags`/`redFlags`/`lastInteractionSummary`/`attractionLevel`) e, quando reconhece padrão problemático recorrente do **homem**, alimenta `UserProfile.redPatterns` (integração W6).

| Campo         | Tipo                | Nota                                                                  |
|---------------|---------------------|-----------------------------------------------------------------------|
| `id`          | String PK           | cuid                                                                  |
| `contactId`   | String FK→Contact   | cascade delete                                                        |
| `happenedAt`  | DateTime            | quando o encontro aconteceu (preenchido pelo user, default = `now()`) |
| `rawText`     | String              | texto livre que o user escreveu no modal (cap 4000 chars na rota)     |
| `extracted`   | Json                | `{ greenFlags[], redFlags[], escalation, mood, nextMove, userRedPatterns?[] }` — preenchido pelo extractor LLM |
| `createdAt`   | DateTime            | default `now()`                                                       |

Index: `(contactId, happenedAt DESC)` — timeline cronológica descendente no perfil.

> **Shape de `extracted`:**
> - `greenFlags: string[]` — sinais positivos novos detectados no encontro (até 6 itens). Merge dedup com `Contact.greenFlags` existente.
> - `redFlags: string[]` — sinais de alerta novos (até 6 itens). Merge dedup com `Contact.redFlags`.
> - `escalation: "regrediu" | "estagnou" | "avancou" | "indefinido"` — leitura do estágio do relacionamento depois do encontro. **Sem acento** (ver nota abaixo).
> - `mood: "leve" | "tenso" | "intenso" | "frustrante" | "neutro"` — temperatura emocional do user no encontro.
> - `nextMove: string` — 1 frase PT-BR com a recomendação concreta de próximo passo (≤180 chars).
> - `summary: string` — 1-2 frases factuais do encontro (≤240 chars). Vira `Contact.lastInteractionSummary`.
> - `attractionDelta: "down" | "same" | "up"` — sinaliza se `Contact.attractionLevel` deve descer/subir/ficar. Aplicado na rota com clamp em `Low|Medium|High`.
> - `userRedPatterns?: string[]` — opcional, até 3 itens. Padrões problemáticos do **homem** detectados no relato (ex: "ele insistiu apesar do desinteresse claro"). Quando presente, vai pra `UserProfile.redPatterns` (cap 200 — reusa `RED_PATTERNS_RAW_DB_CAP` por enquanto, W8 consolida).

> **IN-01 — Enums sem acento (decisão consciente):** os literais de `escalation` no DB/tool/Zod são `avancou` (não `avançou`), `regrediu`, `estagnou`, `indefinido`. Anthropic `input_schema.enum` não garante unicode normalization no output do LLM, e mistura de `"avançou"` vs `"avancou"` faria o Zod rejeitar silenciosamente. Os labels com acento ficam só no frontend (`ESCALATION_LABEL` em `src/components/encounter/encounter-card.tsx`). Mesma regra vale para `mood` se um dia precisar de "frustrante" → cuidado com mistura `ç`/`c` em fixes futuros.

Relations: `contact` (n-1).

> **SECURITY (IN-05):** `encounter_log` **não tem `user_id` direto**. Multi-tenancy é enforced **só** via `contact_id` FK + ownership check do `Contact.userId`. Toda query MUST filtrar por `{ contactId }` E re-validar ownership via `{ contact: { userId } }`. Helper recomendado:
> ```ts
> prisma.encounterLog.findMany({ where: { contact: { userId } } })
> ```
> Padrão seguro: **nunca** expor endpoint `/api/encounters/[id]` sem nesting de `contact.userId`. Se for criar um (timeline cross-contact, ex), começar pelo `contact: { userId }` no `where`. Comentário SECURITY no `prisma/schema.prisma:EncounterLog` reforça o invariante.

> **W7 (25-05-2026):** introduz Diário de Campo. Captura é **síncrona no MVP** — `POST /api/contacts/:id/encounters` grava raw → call Anthropic com tool `submit_encounter_extract` (em `src/lib/flirt/encounter-schema.ts`) → grava `extracted` + atualiza `Contact` em `prisma.$transaction`. Sem fallback se LLM falhar: grava raw + `extracted={ summary, escalation: "indefinido", ... }` mínimo e retorna 200 com flag `degraded=true` no payload (front mostra aviso "Não consegui ler — texto guardado"). Decisão consciente: prioriza preservação do dado bruto do user em detrimento de extração perfeita. Migration `20260525030000_create_encounter_log`.

### `Session`, `Account`, `Verification` (better-auth)
Tabelas canônicas do better-auth. Não tocar manualmente. `Account.password` guarda o hash do email/senha.

### `Contact`
Cada mulher cadastrada por um `User`. Frontend a chama de "conversa" na sidebar.

| Campo                    | Tipo                | Default        |
|--------------------------|---------------------|----------------|
| `id`                     | String PK           | cuid           |
| `userId`                 | String FK→User      |                |
| `name`                   | String              |                |
| `age`                    | Int?                |                |
| `source`                 | String              | "Instagram"    |
| `instagramHandle`        | String?             |                |
| `avatarUrl`              | String?             |                |
| `tags`                   | String[]            | []             |
| `status`                 | ContactStatus enum  | active         |
| `attractionLevel`        | AttractionLevel     | Medium         |
| `personalityType`        | String?             |                |
| `interests`              | String[]            | []             |
| `lastInteractionSummary` | String?             |                |
| `conversationSummary`    | String?             |                |
| `greenFlags`             | String[]            | []             |
| `redFlags`               | String[]            | []             |
| `notes`                  | String?             |                |
| `pinnedAt`               | DateTime?           | null (W8)      |
| `archivedAt`             | DateTime?           | null (W8)      |
| `folderId`               | String?             | null (W8)      |
| `createdAt` / `updatedAt`| DateTime            |                |

Index: `(userId)`, `(userId, updatedAt DESC)`, `(userId, archivedAt, pinnedAt DESC, updatedAt DESC)` (W8), `(userId, folderId)` (W8).

> **W8 (25-05-2026):** três campos novos pra **Org & Hygiene** da sidebar.
> - `pinnedAt` (DateTime?) — null = não fixado, set = fixado naquele instante. Ordena `pinned DESC NULLS LAST`. Cap aplicado na API (`PINNED_CAP = 5`) seguindo padrão Telegram; tentar fixar o 6º retorna 409.
> - `archivedAt` (DateTime?) — soft archive. `null` = lista padrão; set = "Arquivados" tab. Não cascateia delete (não some, só fica fora da lista). Restore = volta `null`. Hard delete continua via `DELETE /api/contacts/[id]` (não muda).
> - `folderId` (String? FK→Folder) — `ON DELETE SET NULL` (delete da pasta não derruba contacts, eles voltam pra "sem pasta"). Constraint: `folder.userId === contact.userId` reforçado na API (não dá pra mover contact pra pasta de outro user).
> - Index composto `(userId, archivedAt, pinnedAt DESC, updatedAt DESC)` cobre a query principal do shell: `WHERE userId = ? AND archivedAt IS NULL ORDER BY pinnedAt DESC NULLS LAST, updatedAt DESC`.
> - Migration `20260525040000_w8_org_hygiene`.

Enums:
- `ContactStatus`: `active` · `cold` · `hot_lead`
- `AttractionLevel`: `Low` · `Medium` · `High`

> **W1 / C5 (24-05-2026):** campo `conversationSummary` é um **rolling summary** gerado via Haiku 4.5 (`claude-haiku-4-5-20251001`) quando `messages.count > 30` pra um contato. O resumo é injetado no system prompt do `/api/coach` **antes das últimas 20 mensagens**, permitindo manter contexto longo sem estourar `HISTORY_CAP`. Migration `20260524240100_add_conversation_summary` (ADD COLUMN nullable, baixo risco).

### `Folder` (W8 — Pastas de organização)
Pasta criada pelo `User` pra agrupar contatos na sidebar. Não tem cor por padrão (chip neutro). Default pasta nenhuma — a "ausência de pasta" é o estado inicial.

| Campo       | Tipo            | Nota                                                |
|-------------|-----------------|-----------------------------------------------------|
| `id`        | String PK       | cuid                                                |
| `userId`    | String FK→User  | cascade delete                                      |
| `name`      | String          | unique por user (case-sensitive). Max 60 chars.     |
| `color`     | String?         | hex `#rrggbb` (formato validado server-side) ou token AILA. Null = chip neutro. |
| `icon`      | String?         | nome de ícone Lucide (ex: `"heart"`, `"flame"`). Null = ícone padrão (`Folder`). |
| `order`     | Int             | default 0. Ordenação manual na sidebar (drag opcional W8.1). |
| `createdAt` | DateTime        |                                                     |
| `updatedAt` | DateTime        | @updatedAt                                          |

Relations: `user` (n-1), `contacts` (1-n) — `Contact.folderId` aponta aqui com `onDelete: SetNull`.
Index: `(userId, order)`. Unique: `(userId, name)` — impede duplicar.
Cap: max 30 pastas por user (validado server-side).

### `TagPreference` (W8 — Cores de tag)
Mapa **user-curado** de `label → cor`. As tags continuam vivendo em `Contact.tags: String[]` (o LLM escreve nelas via tool_use). Esta tabela só define a cor de exibição quando o user pinta uma tag no Tag Manager — tag sem entrada aqui = chip neutro.

| Campo       | Tipo            | Nota                                                |
|-------------|-----------------|-----------------------------------------------------|
| `id`        | String PK       | cuid                                                |
| `userId`    | String FK→User  | cascade delete                                      |
| `label`     | String          | bate exato com strings em `Contact.tags[]`. Max 40 chars (mesmo cap de tag). |
| `color`     | String          | hex `#rrggbb` ou token AILA. Obrigatório (sem entrada = sem cor). |
| `createdAt` | DateTime        |                                                     |

Relations: `user` (n-1).
Unique: `(userId, label)` — uma cor por tag.
Cap: max 100 entradas por user.

> **Decisão (W8):** NÃO migrei `Contact.tags: String[]` pra junction table. Motivo: o LLM escreve tags via tool_use no `/api/coach` (ver `coach-schema.ts`) e mudar isso quebraria a transação atômica `prisma.$transaction` da resposta do coach. `TagPreference` resolve cor com 0 disrupção do pipeline LLM.

### `Message`
Histórico da conversa entre `User` e uma `Contact`. Inclui sugestões e insight do coach quando vem do assistant.

| Campo         | Tipo                  | Nota                                          |
|---------------|-----------------------|-----------------------------------------------|
| `id`          | String PK             | cuid                                          |
| `contactId`   | String FK→Contact     |                                               |
| `sender`      | MessageSender enum    | `user` · `assistant` · `contact`              |
| `content`     | String                |                                               |
| `suggestions` | Json?                 | `[{tone, text, why, risk, likelyResponse}]` quando assistant |
| `insight`     | Json?                 | `{interestLevel, read, move, avoid}`          |
| `attachments` | Json?                 | W3/C6 — anexos do turno do user (imagens). Shape `[{type, mediaType, name, data?}]` |
| `sentIrlAt`   | DateTime?             | W8 — marcado pelo user quando enviou a mensagem no IG/WA real. Só faz sentido pra `sender = user`. Coach exclui mensagens não-`sentIrl` do contexto futuro pra não sugerir o que ainda não foi enviado. |
| `createdAt`   | DateTime              |                                               |

Index: `(contactId, createdAt)` — leitura cronológica.

> **W8 (25-05-2026):** `sentIrlAt` permite ao user marcar "enviei essa no IG". Quando `sender = "user" AND sentIrlAt IS NOT NULL`, a mensagem entra no contexto histórico do `/api/coach` como "já entregue". Quando `sender = "user" AND sentIrlAt IS NULL`, é tratada como "rascunho do coach" (não foi enviada de verdade) e pode ser excluída do contexto se o user mandar uma nova versão. **MVP:** o `/api/coach` continua mandando todas as user-messages como hoje; flag de exclusão fica pra W8.1.

> Cap de contexto: rota `/api/coach` envia só as **20 mensagens mais recentes** pra LLM (HISTORY_CAP, elevado em W1/C5).

> **W3 / C6 (24-05-2026):** `attachments` é populado **apenas no turno do user** quando o shell anexa imagem. Cada item: `type: "image"`, `mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif"`, `name`, `data` (base64 puro, sem prefixo `data:`). O conteúdo da imagem é repassado como `image` block na call Anthropic (vision substitui Tesseract.js client-side). Decisão MVP: base64 inline no DB pra simplicidade; migrar pra URL/R2 depois não exige migration nova (mesmo campo Json, shape extensível).

### `Analysis`
Cache de análises agregadas por contato (não usado no MVP, reservado pra futuro).

### `UsageLog`
Rate limit por `User`. Cada chamada a `/api/coach` insere uma linha. Janela móvel de 1h.

| Campo       | Tipo            |
|-------------|-----------------|
| `id`        | String PK       |
| `userId`    | String FK→User  |
| `route`     | String          |
| `createdAt` | DateTime        |

Index: `(userId, createdAt DESC)`. Rate limit: `RATE_LIMIT_PER_HOUR` (default 60) por user.

## Fluxo de dados

```
Browser (Zustand cache) ←─sync─→ API routes ←─Prisma─→ Postgres
                                       ↓
                                /api/coach ─→ Anthropic Claude Sonnet 4.6
```

- Zustand persiste em `localStorage` como cache offline.
- Boot da app: `GET /api/contacts` hidrata o cache.
- Após resposta do coach: cache é atualizado **e** a mensagem é persistida via `POST /api/messages` (ou implícito na rota `/api/coach` que já persiste).

## Migrations

- `npx prisma migrate dev --name <descricao>` em dev local (precisa Postgres rodando — `docker compose up -d`)
- `npx prisma migrate deploy` em prod (Coolify roda no start)
- **Nunca editar SQL de migrations já aplicadas** — gerar nova migration.

## Roadmap v2 (não implementado)

Schema original Supabase está preservado em `docs/v2-roadmap/schema.sql` pra referência. Decisões adiadas:
- Multi-device sync com `Realtime` (Supabase) — substituído por Postgres + Prisma simples no MVP
- `green_flags` / `red_flags` automáticos via LLM — campos existem mas UI não expõe ainda
- Tabela `Analysis` (agregados) — schema existe, sem leitura/escrita ainda

## Migration history

Ordem cronológica das migrations aplicadas no schema do core (não inclui Profile Watch, que tem seu próprio bloco).

| Timestamp                          | Nome                            | Wave / Ticket   | Impacto                                                                 |
|------------------------------------|---------------------------------|-----------------|-------------------------------------------------------------------------|
| `20260523012636_init`              | init                            | bootstrap       | schema better-auth + domínio FlirtAI v1                                 |
| `20260523223707_profile_watch`     | profile_watch                   | módulo Profile Watch | tabelas `monitored_profile`/`profile_*`/`coaching_suggestion` + enums |
| `20260524214722_desenrolo_profile_fields` | desenrolo_profile_fields | W0              | campos `kind`, `personalityType`, `interests`, etc                      |
| `20260524221957_expand_rating_to_padrao`  | expand_rating_to_padrao  | W0              | dimensões de rating (`beleza`/`inteligencia`/`lealdade`/`respeito`/`vestimenta`) |
| `20260524230000_rename_hot_lead_enum`     | rename_hot_lead_enum     | W0 / C9         | `ContactStatus` literal `'hot lead'` → `'hot_lead'` (Naming Lock)        |
| `20260524240000_encrypt_anthropic_api_key`| encrypt_anthropic_api_key| **W1 / C2**     | DROP `anthropic_api_key` plaintext + ADD `anthropic_api_key_encrypted`  |
| `20260524240100_add_conversation_summary` | add_conversation_summary | **W1 / C5**     | ADD `contact.conversation_summary` pra rolling summary via Haiku        |
| `20260524235721_add_profile_error_count`  | add_profile_error_count  | **W4 / M7**     | contador pra backoff exponencial no cron-runner                         |
| `20260525010000_add_message_attachments`  | add_message_attachments  | **W3 / C6**     | ADD `message.attachments JSONB` pra anexos multimodais (vision substitui Tesseract) |
| `20260525011534_add_user_preferences`     | add_user_preferences     | **W5 / M8**     | ADD `user.timezone`/`locale` (TEXT) + `user.coach_tone` (enum `CoachTone`) + `user.notification_prefs` (JSONB), todos nullable |
| `20260525020000_create_user_profile`      | create_user_profile      | **W6**          | CREATE TABLE `user_profile` (1-1 com user, cascade) com `tone` (CoachTone?), `age`, `location_city`, `context_life`, `demographics` (JSONB), `win_samples` (JSONB default `[]`), `red_patterns_raw` (JSONB default `[]`), `red_patterns` (JSONB default `[]`), `onboarding_done` (BOOL default false) |
| `20260525030000_create_encounter_log`     | create_encounter_log     | **W7**          | CREATE TABLE `encounter_log` (n-1 com contact, cascade) com `happened_at` (TIMESTAMP), `raw_text` (TEXT), `extracted` (JSONB), `created_at` (TIMESTAMP default now()) + INDEX `(contact_id, happened_at DESC)` |
| `20260525040000_w8_org_hygiene`           | w8_org_hygiene           | **W8**          | ADD `contact.pinned_at` (TIMESTAMP NULL), `contact.archived_at` (TIMESTAMP NULL), `contact.folder_id` (TEXT NULL FK→folder ON DELETE SET NULL) + CREATE TABLE `folder` (PK cuid, FK userId cascade, name unique-per-user, color/icon nullable, order Int default 0) + CREATE TABLE `tag_preference` (PK cuid, FK userId cascade, label/color, unique `(userId, label)`) + ADD `message.sent_irl_at` (TIMESTAMP NULL) + INDEX `(userId, archivedAt, pinnedAt DESC, updatedAt DESC)` em Contact pra suportar query principal da sidebar |

---

# Módulo: Profile Watch

> Feature de monitoramento periódico de perfis Instagram com base legítima. **Não é stalking individual** — é inteligência sobre marca/competidor/influencer + self-coach do próprio perfil. Schema desenhado pra recusar campos psicográficos ou de vida privada.

## Princípios do schema

1. **Sem inferência psicográfica.** Nenhum campo do tipo "status afetivo", "ex-namorado", "padrão emocional". O que entra é métrica pública agregada.
2. **Consentimento explícito.** Toda criação de `MonitoredProfile` exige `consentAcceptedAt`. Sem isso, scan não dispara.
3. **Source separa fonte de dados.** `SELF` usa Graph API oficial (OAuth Meta). `COMPETITOR` e `INFLUENCER` usam Apify Instagram Profile Scraper sobre perfis públicos.
4. **Append-only de snapshots.** `ProfileSnapshot` e `ProfilePost` nunca são editados — só inseridos ou flag de "deletado" virado.
5. **Coach IA só pra SELF.** `CoachingSuggestion` só existe pra perfis tipo `SELF` (o usuário pediu sugestões pro PRÓPRIO perfil dele, com OAuth).

## Entidades

### `MonitoredProfile`
Perfil que o `User` cadastrou pra acompanhar.

| Campo                | Tipo                   | Default          | Nota                                                |
|----------------------|------------------------|------------------|-----------------------------------------------------|
| `id`                 | String PK              | cuid             |                                                     |
| `userId`             | String FK→User         |                  |                                                     |
| `source`             | ProfileSource enum     |                  | `self` · `competitor` · `influencer`                |
| `platform`           | ProfilePlatform enum   | `instagram`      | reservado pra TikTok/YouTube futuro                 |
| `handle`             | String                 |                  | sem `@`, lowercase                                  |
| `displayName`        | String?                |                  | nome público                                        |
| `status`             | ProfileWatchStatus     | `active`         | `active` · `paused` · `error`                       |
| `lastErrorMessage`   | String?                |                  | populado quando `status=error`                      |
| `errorCount`         | Int                    | 0                | W4 / M7 — contador de falhas consecutivas, alimenta backoff exponencial do cron |
| `cadenceHours`       | Int                    | 24               | min 6, max 168                                      |
| `lastScanAt`         | DateTime?              |                  | última varredura bem-sucedida                       |
| `nextScanAt`         | DateTime?              |                  | indexed — o cron query usa isso                     |
| `consentAcceptedAt`  | DateTime               |                  | obrigatório no create                               |
| `consentVersion`     | String                 |                  | versão do termo aceito (ex: `2026-05-v1`)           |
| `graphAccessToken`   | String?                |                  | só `source=self`. AES-encrypted em repouso          |
| `graphUserId`        | String?                |                  | só `source=self`. ID do IG Business                 |
| `graphTokenExpiresAt`| DateTime?              |                  | long-lived ~60 dias                                 |
| `createdAt`/`updatedAt`| DateTime             |                  |                                                     |

Index: `(userId)`, `(nextScanAt, status)` — query do cron filtra por `status=active AND nextScanAt <= NOW`.
Unique: `(userId, platform, handle)` — mesmo handle não duplica por user.

Invariantes:
- `source=self` ⇒ `graphAccessToken` e `graphUserId` obrigatórios após OAuth concluir.
- `source ∈ {competitor, influencer}` ⇒ `graphAccessToken` SEMPRE null.
- Perfil privado detectado no primeiro scan ⇒ `status=error` + bloqueio do scan.
- `errorCount` reseta pra 0 quando scan sucede; cap em 12 (gera backoff máximo 24h).

### `ProfileSnapshot`
Foto agregada do perfil num momento. Imutável.

| Campo            | Tipo                | Nota                                                |
|------------------|---------------------|-----------------------------------------------------|
| `id`             | String PK           | cuid                                                |
| `profileId`      | String FK→MonitoredProfile |                                              |
| `capturedAt`     | DateTime            |                                                     |
| `followersCount` | Int                 |                                                     |
| `followingCount` | Int                 |                                                     |
| `postsCount`     | Int                 |                                                     |
| `bio`            | String?             |                                                     |
| `avatarUrl`      | String?             |                                                     |
| `isVerified`     | Boolean             | default false                                       |
| `isPrivate`      | Boolean             | default false                                       |
| `externalUrl`    | String?             | link na bio                                         |
| `category`       | String?             | categoria de negócio do IG (se Business)            |
| `rawPayload`     | Json                | payload do scraper, pra debug                       |

Index: `(profileId, capturedAt DESC)`.

### `ProfilePost`
Post/Reel observado. Histórico vive aqui mesmo após delete (flag), pra detectar "post sumiu".

| Campo                | Tipo                | Nota                                          |
|----------------------|---------------------|-----------------------------------------------|
| `id`                 | String PK           | cuid                                          |
| `profileId`          | String FK           |                                               |
| `shortcode`          | String              | ID público do IG (ex: `DYC_VQcEdEJ`)          |
| `mediaType`          | ProfilePostType     | `image` · `carousel` · `reel` · `video`       |
| `caption`            | String?             | até 2200 chars                                |
| `thumbnailUrl`       | String?             | snapshot da capa (CDN do IG expira; refresh em cada scan) |
| `permalink`          | String              | `https://instagram.com/p/{shortcode}/`        |
| `postedAt`           | DateTime?           | quando o post foi criado no IG                |
| `firstSeenAt`        | DateTime            |                                               |
| `lastSeenAt`         | DateTime            | atualizado em todo scan que ainda vê o post   |
| `isDeleted`          | Boolean             | default false                                 |
| `deletedDetectedAt`  | DateTime?           |                                               |
| `lastMetrics`        | Json?               | `{ likes, comments, views, plays }`           |

Index: `(profileId, postedAt DESC)`, `(profileId, isDeleted)`.
Unique: `(profileId, shortcode)`.

Detecção de delete: ao fim de cada scan, posts do scrape anterior que não vieram no novo são marcados `isDeleted=true` + `deletedDetectedAt=now()`. **Reaparição** (raro): se voltar, `isDeleted` volta pra false e log incremental fica no `ProfileReport`.

### `ProfileReport`
Relatório consolidado por janela (default diário). Gerado por LLM via `tool_use`.

| Campo                | Tipo                | Nota                                          |
|----------------------|---------------------|-----------------------------------------------|
| `id`                 | String PK           |                                               |
| `profileId`          | String FK           |                                               |
| `windowStart`        | DateTime            |                                               |
| `windowEnd`          | DateTime            |                                               |
| `newPostsCount`      | Int                 |                                               |
| `deletedPostsCount`  | Int                 |                                               |
| `followersDelta`     | Int                 | pode ser negativo                             |
| `engagementAvg`      | Float?              | média (likes+comments)/seguidores no período  |
| `aiSummary`          | String              | parágrafo curto PT-BR gerado pelo coach       |
| `aiHighlights`       | Json                | array `[{ type, label, value }]`              |
| `createdAt`          | DateTime            |                                               |

Index: `(profileId, windowEnd DESC)`.
Unique: `(profileId, windowStart, windowEnd)` — idempotência do cron.

### `CoachingSuggestion`
Sugestão de melhoria pro **PRÓPRIO** perfil do usuário. Só `source=self`.

| Campo          | Tipo                  | Nota                                  |
|----------------|-----------------------|---------------------------------------|
| `id`           | String PK             |                                       |
| `profileId`    | String FK             | invariante: profile.source = `self`   |
| `dimension`    | CoachingDimension     | `bio` · `grid` · `cadence` · `pillars` · `engagement` |
| `severity`     | CoachingSeverity      | `info` · `suggestion` · `critical`    |
| `title`        | String                | uma frase                             |
| `description`  | String                | parágrafo                             |
| `actionItems`  | Json                  | array de strings                      |
| `acknowledged` | Boolean               | default false (usuário marcou "ok")   |
| `createdAt`    | DateTime              |                                       |

Index: `(profileId, acknowledged, createdAt DESC)`.

## Enums (Postgres lowercase, TS snake_case)

| Enum                  | Valores                                            |
|-----------------------|----------------------------------------------------|
| `ProfileSource`       | `self` · `competitor` · `influencer`               |
| `ProfilePlatform`     | `instagram`                                        |
| `ProfileWatchStatus`  | `active` · `paused` · `error`                      |
| `ProfilePostType`     | `image` · `carousel` · `reel` · `video`            |
| `CoachingDimension`   | `bio` · `grid` · `cadence` · `pillars` · `engagement` |
| `CoachingSeverity`    | `info` · `suggestion` · `critical`                 |

## Fluxo do cron (resumo)

```
Coolify scheduler (ou cron-job.org) → POST /api/cron/profile-scan
  Header: X-Cron-Secret = CRON_SECRET
  Body: vazio (cron varre todos profiles vencidos)

Handler:
  SELECT * FROM monitored_profile
    WHERE status = 'active' AND next_scan_at <= NOW()
    LIMIT 50  ← bounded por chamada
  ORDER BY next_scan_at ASC

  Para cada profile:
    if source = self:
      → Graph API (token do profile) → /me/media + /me
    else:
      → Apify Instagram Profile Scraper actor (handle público)

    → upsert ProfileSnapshot (append-only via insert)
    → diff posts:
        novos    → INSERT ProfilePost (firstSeenAt = now, lastSeenAt = now)
        vistos   → UPDATE ProfilePost.lastSeenAt + lastMetrics
        sumidos  → UPDATE isDeleted=true, deletedDetectedAt=now

    → se cruzou janela do report (default 24h desde último ProfileReport):
        → Anthropic call com tool `submit_profile_report` → cria ProfileReport
        → se source=self e semana fechou (segunda 00:00 local user): roda
          tool `submit_coaching_suggestions` → cria CoachingSuggestion(s)

    → MonitoredProfile.lastScanAt = now
    → MonitoredProfile.nextScanAt = now + cadenceHours
    → em caso de erro: status=error, lastErrorMessage=...
```

## Conformidade e guard-rails

- **LGPD base legal:** legítimo interesse comercial (concorrência, influencer marketing) + execução de contrato (self-coach). Banner no cadastro explicita.
- **Termo aceito por perfil** com `consentVersion` versionado. Mudança no termo ⇒ migration força re-aceite.
- **Hard-block em perfis privados.** Tentou cadastrar privado ⇒ scan falha e profile vai pra `status=error` com mensagem clara.
- **Sem campos sobre pessoa.** O schema NÃO TEM `dating_status`, `partner_handle`, `is_in_relationship`. Tentativa de adicionar = rejeitar PR.
- **Rate limit:** scan manual disparado por user reaproveita `UsageLog` (`route=profile-scan`).
- **Retenção:** `ProfileSnapshot` e `ProfilePost` mantidos 180 dias; soft-purge agendado. Configurável via env.

## Variáveis de ambiente novas

```
APIFY_API_TOKEN                # token Apify pra rodar actor
APIFY_INSTAGRAM_ACTOR_ID       # default: apify/instagram-profile-scraper
META_APP_ID                    # Meta App ID (Facebook Developers)
META_APP_SECRET                # Meta App Secret
META_OAUTH_REDIRECT_URI        # https://flirtai.../api/profiles/oauth/meta/callback
CRON_SECRET                    # bearer pro endpoint /api/cron/profile-scan
PROFILE_WATCH_RETENTION_DAYS   # default 180
```
