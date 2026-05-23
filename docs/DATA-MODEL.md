# FlirtAI — DATA-MODEL

> Schema-First. Source of truth: `prisma/schema.prisma`. Tudo em snake_case no Postgres, camelCase via Prisma `@map`.

## Convenção de naming (Naming Lock)

| Camada       | Estilo      | Exemplo                  |
|--------------|-------------|--------------------------|
| Tabela DB    | snake_case  | `usage_log`              |
| Coluna DB    | snake_case  | `attraction_level`       |
| Modelo TS    | PascalCase  | `Contact`                |
| Campo TS     | camelCase   | `attractionLevel`        |
| Enum DB      | snake_case  | `hot lead` (literal)     |
| Enum TS      | snake_case  | `hot_lead`               |

## Entidades

### `User` (better-auth)
Pessoa logada. Multi-tenant por `userId`.

| Campo           | Tipo       | Nota                                 |
|-----------------|------------|--------------------------------------|
| `id`            | String PK  | cuid                                 |
| `email`         | String     | UNIQUE                               |
| `emailVerified` | Boolean    | default false                        |
| `name`          | String?    |                                      |
| `image`         | String?    |                                      |
| `createdAt`     | DateTime   |                                      |
| `updatedAt`     | DateTime   |                                      |

Relations: `sessions`, `accounts`, `contacts`, `usageLogs`.

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
| `greenFlags`             | String[]            | []             |
| `redFlags`               | String[]            | []             |
| `notes`                  | String?             |                |
| `createdAt` / `updatedAt`| DateTime            |                |

Index: `(userId)`, `(userId, updatedAt DESC)` — pra ordenar conversas pelo topo.

Enums:
- `ContactStatus`: `active` · `cold` · `hot lead`
- `AttractionLevel`: `Low` · `Medium` · `High`

### `Message`
Histórico da conversa entre `User` e uma `Contact`. Inclui sugestões e insight do coach quando vem do assistant.

| Campo         | Tipo                  | Nota                                          |
|---------------|-----------------------|-----------------------------------------------|
| `id`          | String PK             | cuid                                          |
| `contactId`   | String FK→Contact     |                                               |
| `sender`      | MessageSender enum    | `user` · `assistant` · `contact`              |
| `content`     | String                |                                               |
| `suggestions` | Json?                 | `[{tone, text, why}]` quando assistant        |
| `insight`     | Json?                 | `{interestLevel, read, move, avoid}`          |
| `createdAt`   | DateTime              |                                               |

Index: `(contactId, createdAt)` — leitura cronológica.

> Cap de contexto: rota `/api/coach` envia só as **8 mensagens mais recentes** pra LLM.

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
