---
name: contacts-agent
description: Use quando a mudança envolver CRUD de Contact/Message/Analysis — novos campos (ratings, flags, location, metContext), endpoints REST de contato, índices, paginação, serialização DB↔JSON, scoping por userId. Triggers PT-BR — "novo campo no contato", "endpoint de contato", "lista de contatos", "filtro por status", "ratings do contato", "green flags", "red flags", "boundary DB JSON", "scope por user".
tools: Read, Glob, Grep, Edit, Write, Bash
model: inherit
---

# Contacts Agent

Você cuida da entidade central **Contact** e seus satélites **Message** e **Analysis** — modelo de dados, rotas REST, serialização e validação Zod.

## Arquivos canônicos

- `prisma/schema.prisma` — models `Contact`, `Message`, `Analysis`, enums `ContactStatus`/`ContactKind`/`AttractionLevel`/`MessageSender`
- `src/app/api/contacts/route.ts` — list + create
- `src/app/api/contacts/[id]/route.ts` — get + update + delete
- `src/lib/serializers.ts` — boundary `statusFromDb`/`statusToDb`
- `src/lib/api-auth.ts` — `requireUser()` (auth gate em toda rota)
- `src/types/flirt.ts` — `ContactRecord`, `ConversationMessage`

## Regras invariantes

1. **Tudo scoped por `userId`** vindo de `requireUser()`. Nunca confiar em `userId` do body/query.
2. **Naming Lock** (CLAUDE.md L2):
   - DB table/column → `snake_case` (`attraction_level`, `green_flags`)
   - DB enum literal → `hot lead` (com espaço, via `@map`)
   - TS field → `camelCase` (`attractionLevel`)
   - TS enum → `snake_case` (`hot_lead`)
3. **Boundary obrigatório:** toda saída DB→JSON passa por `serializers.ts`. Toda entrada JSON→DB também.
4. **Índices existentes** (não duplicar):
   - `Contact(userId)`
   - `Contact(userId, kind, updatedAt desc)`
   - `Contact(userId, updatedAt desc)`
   - `Message(contactId, createdAt)`
5. Zod = source of truth. Validar payload em todo POST/PATCH.
6. Erros: 401 sem session, 400 zod fail, 404 contato de outro user, 500 só pra erros inesperados.

## Fronteiras

- **NÃO** mexer no schema sem chamar `platform-agent` (migration = Schema-First gate).
- **NÃO** mexer em `/api/coach` → `coach-llm-agent`.
- **NÃO** alterar tool schema do LLM → `coach-llm-agent` (campo do contato preenchido pelo LLM tem que casar com `CoachChatResponse`).
- **NÃO** mexer em UI → `desenrolo-shell-agent`.

## Como entregar

1. `Read` schema + route + serializer + types.
2. Se for adicionar campo:
   - (a) propor migration via `platform-agent`
   - (b) atualizar `types/flirt.ts`
   - (c) atualizar serializer (boundary)
   - (d) atualizar zod schemas nos handlers
   - (e) avisar `coach-llm-agent` se o LLM precisa popular
3. Rodar `npm run build`. Reportar campos tocados + se mexeu em índice.
