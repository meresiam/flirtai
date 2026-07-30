# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev                              # Next dev (Turbopack) on :3000
npm run build                            # production build (output: standalone)
npm run start                            # serve production build
npm run lint                             # eslint via eslint-config-next

docker compose up -d                     # Postgres 16 local (user/pass/db = flirtai)
npx prisma migrate dev --name <desc>     # new migration in dev
npx prisma migrate deploy                # apply pending migrations (runs at container start)
npx prisma generate                      # regenerate client after schema change
npx prisma studio                        # browse DB
```

No test runner is configured. Lint + `tsc --noEmit` (implicit via `next build`) are the only gates.

## Stack notes (read before writing code)

- **Next.js 16** — `middleware.ts` is deprecated; auth gating lives in `src/proxy.ts` **(must sit next to `app/`, not at repo root — see ADR-007)**. App code lives in `src/app/` (path alias `@/*` → `./src/*`). Build uses Turbopack. Keep `output: "standalone"` in `next.config.ts` — the Dockerfile copies `.next/standalone` + `.next/static` and depends on `server.js` existing.
- **Prisma 7** — the datasource URL lives in `prisma.config.ts` (not `schema.prisma`). The client is built with `@prisma/adapter-pg` (driver adapter) instead of the binary engine; `src/lib/db.ts` constructs `PrismaPg` from `DATABASE_URL` and caches the client on `globalThis` in dev.
- **better-auth** — email+password, schema is canonical (`user`, `session`, `account`, `verification` tables, all `@map`-ed to snake_case). Don't hand-edit those tables. Server-side session lookup uses `auth.api.getSession({ headers: await headers() })`; client uses `src/lib/auth-client.ts` hooks.
- **Anthropic tool_use for structured output** — the coach route forces `tool_choice: { type: "tool", name: "submit_flirt_response" }` against the schema in `src/lib/flirt/coach-schema.ts`. The model's response is read from the `tool_use` block, not from text. Mirror this pattern for any new structured LLM call.

## Architecture

Single-tenant-per-user wingman chat. One user → many `Contact`s → many `Message`s. Each coach turn is one Anthropic call that returns *both* a chat reply *and* a refreshed contact profile in one tool invocation, then persisted in a single Prisma `$transaction`.

### Request flow for a coach turn

```
client (flirt-ai-shell)
  └─ POST /api/coach { contactId, prompt, mode: "incoming" | "strategy" }
       │
       ├─ auth.api.getSession()                      → 401 if no session
       ├─ zod parse                                  → 400 on bad payload
       ├─ checkAndConsumeRateLimit(userId, "coach")  → 429 + Retry-After (60/h default)
       ├─ load User (anthropicApiKey/Model override) + Contact (+ last 8 messages, HISTORY_CAP)
       ├─ Anthropic.messages.create({
       │     model: user override ?? env ?? "claude-sonnet-4-6",
       │     system: buildSystemPrompt(mode),
       │     tools: [coachToolSchema],
       │     tool_choice: { type: "tool", name: COACH_TOOL_NAME }
       │   })
       ├─ extract tool_use block → CoachChatResponse
       └─ prisma.$transaction([
            create user Message,
            create assistant Message (with suggestions + insight JSON),
            update Contact (status / attractionLevel / personalityType / interests / tags / lastInteractionSummary)
          ])
```

`status` is normalized at the boundary: the LLM emits `"hot lead"` (per the tool schema enum), Postgres stores `hot_lead` (per `ContactStatus` enum's `@map`). `lib/serializers.ts::statusFromDb` reverses this on the way out.

### Client state model

The shell (`src/components/flirt-ai-shell.tsx`, ~1300 lines, intentionally monolithic) is the only consumer of the Zustand store in `src/store/use-flirt-store.ts`.

- Store persists `contacts` + `selectedContactId` to `localStorage` (key `flirt-ai-store`, `version: 4`, `skipHydration: true`).
- `bootstrap()` fetches `/api/contacts`; on 401 it hard-redirects to `/login` (because `proxy.ts` excludes `/api` from the matcher, so API responses are clean JSON 401s instead of 307s).
- `applyCoachResponse()` merges the LLM contact patch into the existing contact (preserving non-empty `tags` / `interests` if the LLM returned empty arrays), appends the assistant bubble, and moves the contact to the top of the sidebar.
- Bumping the store's `version` when changing partialized fields is how stale per-user cache from another login gets invalidated.

### Auth gating

Two layers, by design:
1. `proxy.ts` (Next 16 replacement for middleware) — checks for the `better-auth.session_token` cookie and redirects HTML routes to `/login`. **The matcher excludes `/api`** so fetches surface 401 JSON instead of redirects.
2. Each API route calls `requireUser()` (`src/lib/api-auth.ts`) which returns either a `userId` string or a `NextResponse` to short-circuit with — the `/api/coach` route inlines the same check.

### Naming Lock (enforced across stack)

| Layer        | Style       | Example                |
|--------------|-------------|------------------------|
| DB table     | snake_case  | `usage_log`            |
| DB column    | snake_case  | `attraction_level`     |
| DB enum lit. | snake_case  | `hot lead` (literal)   |
| TS field     | camelCase   | `attractionLevel`      |
| TS enum      | snake_case  | `hot_lead`             |
| File         | kebab-case  | `flirt-ai-shell.tsx`   |
| Component    | PascalCase  | `<FlirtAiShell />`     |

`@map`/`@@map` in `schema.prisma` is the bridge. `src/lib/serializers.ts` is the boundary for everything that crosses DB→JSON.

### Layout

All app code lives under `src/` (path alias `@/*` → `./src/*`). `proxy.ts`, `prisma/`, `prisma.config.ts`, `components.json` (shadcn), and all Next/tooling configs stay at the repo root because their respective tools require it.

```
src/app/        Next App Router (pages + /api routes)
src/components/ React components (flirt-ai-shell.tsx is the monolithic UI)
src/lib/        server + client utilities (db, auth, rate-limit, flirt/*, use-ocr)
src/store/      Zustand client store
src/types/      shared TS types
```

### Where things live

- `src/app/api/coach/route.ts` — the only LLM-calling route; all structured-output rules live here + `src/lib/flirt/`.
- `src/app/api/contacts/route.ts` + `[id]/route.ts` — contact CRUD; always scoped by `userId` from `requireUser()`.
- `src/app/api/settings/route.ts` — per-user override of `anthropicApiKey` / `anthropicModel` (read inside `/api/coach`).
- `src/lib/flirt/system-prompt.ts` — voice/ethics/mode prompts, joined by `buildSystemPrompt(mode)`. PT-BR.
- `src/lib/flirt/coach-schema.ts` — Anthropic Tool definition; source of truth for the response shape.
- `src/lib/use-ocr.ts` — Tesseract.js worker (singleton `workerPromise`) for image attachments; lazy-loads `por`+`eng` language data.
- `src/types/flirt.ts` — shared `CoachChatResponse`, `ContactRecord`, `ConversationMessage`, `ReplySuggestion`, `MessageInsight`.

## Conventions

- Schema-First → DATA-MODEL is `prisma/schema.prisma`; never mutate already-applied SQL in `prisma/migrations/`, generate a new one.
- Component-First — UI intentionally lives in one shell file; don't split for splitting's sake.
- Coach route caps history at `HISTORY_CAP = 8` messages and `max_tokens: 2048`. Increasing either has cost + latency implications.
- Errors from the Anthropic SDK with `status === 404` are reported as "modelo não disponível" (likely a wrong `ANTHROPIC_MODEL`); other failures bubble up as 502.
- Rate limit is a `UsageLog` row per call, counted over a sliding 1h window — there's no Redis or cache, so it's exactly accurate and exactly as expensive as `COUNT(*)` with a `(userId, createdAt DESC)` index.

## Deploy

Dockerfile is a 3-stage build (deps → builder → runner) on `node:22-alpine`. The runner copies the Next standalone bundle + Prisma client + the `prisma` CLI + `dotenv` so the start command can run migrations:

```
npx prisma migrate deploy && node server.js
```

Coolify is the target host. `DATABASE_URL`, `ANTHROPIC_API_KEY`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` are required at runtime; `ADMIN_EMAILS` (lista separada por vírgula) habilita o /admin e a aprovação de cadastros. `BETTER_AUTH_URL` also drives `trustedOrigins` in `lib/auth.ts` — set it to the public URL or auth requests will be rejected.

### Pipeline Coolify (aprendido em 30-07-2026)

- Instância: `https://coolify.meresiam.com` (token em `$MERESCLAUDE/.env` → `COOLIFY_API_TOKEN` / `COOLIFY_BASE_URL`). A instância `coolify.ailalabs.com` NÃO hospeda este app.
- UUIDs: projeto `h7oyeqc4qsa22rxp3qb8wdyi` · app `t11djtug6y6qpfnxelzt7wfg` (flirtai-app) · Postgres `lqf675lvsk7p8glep7w8bzsc`.
- Push em `origin/main` NÃO dispara auto-deploy (sem webhook GitHub configurado). Deploy manual:
  `curl -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$COOLIFY_BASE_URL/api/v1/deploy?uuid=t11djtug6y6qpfnxelzt7wfg"`
- Poll: `GET /api/v1/deployments` (em andamento) e `GET /api/v1/deployments/applications/{uuid}` (histórico).
- **ATENÇÃO:** o token precisa das permissões `read + write + deploy` no Coolify (Keys & Tokens → API tokens). Token read-only responde `{"message":"Missing required permissions: deploy"}` — foi o bloqueio em 30-07-2026. Sem SSH na VPS (nenhuma key local autentica em root@coolify.meresiam.com).
- Migrations aplicam sozinhas no boot do container (`prisma migrate deploy` no CMD).

### Smoke pós-deploy

1. `curl -s -o /dev/null -w "%{http_code}" https://flirtai.meresiam.com/login` → 200.
2. `curl -s https://flirtai.meresiam.com/api/contacts` → 401 JSON (sem sessão).
3. Fluxo real de signup via browser: criar conta teste → deve cair em `/aguardando` (gate de aprovação) com APIs respondendo 403 `pending_approval`.
4. Login com conta aprovada → coach responde streaming; `/admin` acessível só pra `ADMIN_EMAILS`.
