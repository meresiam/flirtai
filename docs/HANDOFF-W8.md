---
title: HANDOFF-W8 — Org & Hygiene
date: 25-05-2026
wave: W8
status: entregue (smoke manual pendente)
projeto: flirtai
---

# HANDOFF-W8 — Org & Hygiene

> Wave dedicada a desbloquear organização da sidebar e higiene de histórico:
> pin · pastas · arquivar (não delete) · tags coloridas · status "enviei no IG" · timeline de encontros como tab.

## Status

**Backend + UI entregues e comitados.** TypeScript clean, lint sem erros novos, `next build` standalone passa com as 7 rotas novas listadas. Smoke E2E manual contra o servidor dev ainda não rodado por Meres.

Commits:
- `bbb28b0 feat(flirtai): W8 Org & Hygiene — schema + API + store`
- `6b4a759 feat(flirtai): W8 Org & Hygiene UI — sidebar, modais e timeline tab`

## What works (já entregue no código)

### Schema (migration `20260525201553_w8_org_hygiene`)
- `Contact.pinnedAt`, `Contact.archivedAt`, `Contact.folderId` (FK SetNull)
- `Folder` model (CRUD per-user, cap 30, unique name)
- `TagPreference` model (label → cor, cap 100)
- `Message.sentIrlAt`
- Index novo `(userId, archivedAt, pinnedAt DESC, updatedAt DESC)` cobre query principal da sidebar

### API
- `GET /api/contacts?archived=true|false|all&folderId=cuid|none`
- `POST/DELETE /api/contacts/[id]/pin` — cap 5, retorna 409 + `code: PINNED_CAP` quando estoura
- `POST/DELETE /api/contacts/[id]/archive` — archive limpa pin
- `PUT /api/contacts/[id]/folder` — body `{ folderId: string | null }`
- `GET/POST /api/folders` + `PATCH/DELETE /api/folders/[id]`
- `GET/POST /api/tag-preferences` + `DELETE /api/tag-preferences/[label]`
- `POST/DELETE /api/messages/[id]/sent-irl` — só aceita `sender = user`

### Store Zustand (v8, force-invalidate cache pre-W8)
- Estado: `folders`, `tagPreferences`, `selectedFolderId`, `showArchived`, `pendingArchiveUndo`
- 14 actions novas: pin/unpin/archive/restore/moveContactToFolder/createFolder/updateFolder/deleteFolder/selectFolder/toggleArchivedView/setTagPreference/removeTagPreference/markMessageSentIrl/clearArchiveUndo
- Bootstrap paraleliza `/api/contacts` + `/api/folders` + `/api/tag-preferences` (Promise.all)

### UI
- Sidebar com filter bar de chips ("Tudo · pastas · Arquivados") + badge de pinned count
- ContactCard com `<ContactContextMenu>` (Fixar/Mover/Arquivar/Apagar) que aparece on-hover
- Pin icon visível na linha quando contact tem `pinnedAt`
- Tag chips coloridos (até 3) com cor vinda de TagPreference; "+N" pra overflow
- `<FolderManagerModal>` — CRUD com palette de 8 cores AILA + ícone Folder colorido
- `<TagManagerModal>` — pinta cada tag em uso; ordem por count desc
- `<ArchiveUndoToast>` — 10s flutuante com barra de progresso + "Desfazer"
- User bubble com toggle "Marcar como enviado" → "Enviei" (verde quando set)
- `/desenrolos/[id]` agora usa `<Tabs>` Sinais / Encontros (count)

## Smoke criteria — pra Meres rodar

Rodar dev local:

```bash
cd MeresClaude/projetos/flirtai
docker compose up -d           # ou Postgres local se preferir
npm run dev                    # :3000
```

Fluxo manual (sem auto E2E pra W8):

1. **Pin** — clica num contato qualquer → ⋯ → "Fixar no topo". Pin icon ⭐ aparece no card. Recarrega a página → ainda no topo. Fixa mais 5 — o 6º deve mostrar erro 409 "Desfixe outro primeiro".
2. **Pastas** — sidebar → "Gerenciar" no canto direito da filter bar → cria pasta "Hot leads" com cor `#10b981`. Volta pro contato → ⋯ → "Adicionar a uma pasta..." → escolhe "Hot leads". Chip da pasta aparece na filter bar; clica nele → só esse contato aparece.
3. **Arquivar** — ⋯ → "Arquivar". Some da lista, toast aparece "X arquivado. Desfazer" com barra de 10s. Aperta "Desfazer" → volta. Arquiva de novo, deixa toast expirar → ainda assim acessível via chip "Arquivados". Clica nele → "Restaurar" no menu.
4. **Tags coloridas** — manda algumas mensagens (coach cria tags). Footer sidebar → "Gerenciar tags coloridas" → pinta uma tag com `#ff355d`. Volta pra sidebar; o chip da tag agora aparece colorido no card.
5. **Sent IRL** — em qualquer chat, na bubble do user, clica "Marcar como enviado" no canto. Vira "Enviei" verde. Recarrega → estado persiste no DB.
6. **Timeline tab** — abre `/desenrolos/[id]` → vê tabs "Sinais" e "Encontros (N)". Toca em Encontros → vê timeline. Toca em Sinais → vê painel de flags/notas.

## Done criteria

- [x] Schema-First: DATA-MODEL.md + COMPONENT-MAP.md atualizados antes da migration
- [x] Migration `20260525201553_w8_org_hygiene` aplicada em dev local com sucesso
- [x] `npx tsc --noEmit` limpo
- [x] `npm run lint` sem erros novos (4 warnings pré-existentes)
- [x] `npm run build` standalone passa, todas as 7 rotas novas listadas
- [x] Naming Lock respeitado em todas as colunas/tabelas/enums
- [x] Multi-tenancy via `userId` em todas as queries novas (Message ownership via `contact.userId`)
- [x] Cap PINNED 5 enforced em transação atômica (evita race)
- [x] onDelete SetNull em `Contact.folderId` (deletar pasta não derruba contacts)
- [ ] **Pendente Meres**: smoke E2E manual 6-passos acima
- [ ] **Pendente**: deploy em prod (Coolify) — sobe via `git push` após smoke

## Blockers — nenhum

## Next steps

### W8.1 (pode ser separado em outra sessão)
- Drag-and-drop pra reordenar pastas
- Bulk actions (selecionar múltiplos contatos → arquivar/mover)
- Pesquisa nas mensagens (`pg_trgm` ou `tsvector` em `message.content`)
- Snooze por contato (lembrete agendado)
- Mute do coach por contato (`Contact.coachMuted: boolean`)

### Backlog longo
- Cmd+K spotlight (contato + mensagem + tag)
- Export do chat (.txt/.json/.pdf)
- Reorder visual de pinned (drag dentro do bloco fixados)

## Guard-rails — NÃO violar

1. **Não mude `Contact.tags: String[]` pra junction table.** O LLM escreve nele via tool_use no `/api/coach`. TagPreference resolve o problema de cor sem disrupção.
2. **Não use `next/dynamic` ou lazy-load nos modais W8.** Eles são leves; lazy-load adiciona latência no primeiro abrir. Reavaliar se shell passar de 2000 linhas.
3. **Não suba PINNED_CAP além de 5 sem confirmar com Meres.** É padrão Telegram conhecido pelo user.
4. **Não comece W8.1 sem smoke W8 completo.** O risco de regredir pin/archive aumenta com bulk actions sobre soft-state.
5. **MOBILE-FIRST**: o sidebar drawer mobile ainda renderiza tudo W8 — mas a filter bar de chips precisa scroll horizontal smooth. Já implementado com `overflow-x-auto scrollbar-none` em `sidebar-filter-bar.tsx`. Conferir em 320px antes de fechar wave.
6. **Nielsen H3 (Controle)**: archive tem undo 10s (cumpre). Delete tem confirm inline no menu (cumpre). Pin não tem undo — é reversível em 1 clique (Desfixar), ok.

## Arquivos modificados/criados

```
M  docs/COMPONENT-MAP.md
M  docs/DATA-MODEL.md
A  docs/HANDOFF-W8.md  (este arquivo)
M  prisma/schema.prisma
A  prisma/migrations/20260525201553_w8_org_hygiene/migration.sql
M  src/app/api/contacts/route.ts
A  src/app/api/contacts/[id]/archive/route.ts
A  src/app/api/contacts/[id]/folder/route.ts
A  src/app/api/contacts/[id]/pin/route.ts
A  src/app/api/folders/route.ts
A  src/app/api/folders/[id]/route.ts
A  src/app/api/messages/[id]/sent-irl/route.ts
A  src/app/api/tag-preferences/route.ts
A  src/app/api/tag-preferences/[label]/route.ts
M  src/app/desenrolos/[id]/page.tsx
M  src/components/flirt-ai-shell.tsx
A  src/components/sidebar/archive-undo-toast.tsx
A  src/components/sidebar/contact-context-menu.tsx
A  src/components/sidebar/folder-manager-modal.tsx
A  src/components/sidebar/sidebar-filter-bar.tsx
A  src/components/sidebar/tag-manager-modal.tsx
M  src/lib/serializers.ts
M  src/store/use-flirt-store.ts
M  src/types/flirt.ts
```

## Próxima sessão — prompt de retomada (minimalista)

```
Rodar smoke W8 em flirtai (docs/HANDOFF-W8.md seção "Smoke criteria").
Se passar tudo: gerar HANDOFF-W8.1 com bulk actions + busca msg.
Se falhar: registrar em dev-log e corrigir.
```
