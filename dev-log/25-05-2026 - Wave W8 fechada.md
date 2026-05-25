---
alias: dev-log-flirtai-w8-fechada
type: dev-log
status: done
tags: [flirtai, wave/W8, dev-log, org-hygiene, pin, archive, folder, tag-color, sent-irl]
date_e_hora: 25-05-2026
priority: medium
projeto: flirtai
documento: dev-log-W8-fechada
mci_versao: v7.7
---

# Wave W8 — Org & Hygiene — FECHADA

**Data:** 25-05-2026
**Branch:** master
**Status:** ✅ DONE no código — typecheck/lint/build verdes. Smoke E2E manual pendente do Meres.

## Origem

Meres pediu 3 features ("apagar chats / pastas / fixar") + sugestões. Brainstorm devolveu 10 features extras; ele escolheu o conjunto:

1. Pin/Fixar
2. Pastas
3. **Arquivar** (no lugar de delete — soft archive com undo)
4. Tags coloridas filtráveis
5. Status de leitura no histórico ("enviei no IG")
6. Histórico de encontros (timeline tab no painel direito)

UX decisões confirmadas via 2-perguntas:
- Soft archive com toast undo 10s (padrão Gmail/Telegram)
- Cap pinned = 5 (padrão Telegram)
- "Enviei no IG" 1-clique no bubble user (não checkbox grande)
- Timeline = tab separada (não intercalar com chat)
- Tag Manager = user define cor (não auto-hash)

## O que entrou

### Schema (migration `20260525201553_w8_org_hygiene`)
- `Contact.pinnedAt: DateTime?` (null = não fixado)
- `Contact.archivedAt: DateTime?` (null = ativo — soft archive)
- `Contact.folderId: String?` (FK → folder, ON DELETE SET NULL)
- Novo model `Folder` (cuid, userId FK cascade, name unique-per-user, color hex?, icon Lucide?, order Int)
- Novo model `TagPreference` (cuid, userId FK cascade, label, color hex, unique `(userId, label)`)
- `Message.sentIrlAt: DateTime?`
- Index novo `(userId, archivedAt, pinnedAt DESC, updatedAt DESC)` cobre query principal da sidebar
- Index `(userId, folderId)`

### API (7 rotas novas + GET /api/contacts expandido)
- `GET /api/contacts` aceita `?archived=true|false|all` e `?folderId=cuid|none`. Ordering: pinned DESC NULLS LAST, depois updatedAt DESC.
- `POST/DELETE /api/contacts/[id]/pin` — cap 5 em transação (`prisma.$transaction` contendo `count` + `update`). 6º tentativa → 409 com `code: PINNED_CAP`.
- `POST/DELETE /api/contacts/[id]/archive` — archive limpa pin junto.
- `PUT /api/contacts/[id]/folder` — valida que folder pertence ao mesmo userId (cross-tenant guard).
- `GET/POST /api/folders` + `PATCH/DELETE /api/folders/[id]` — cap 30, unique name handling com retorno 409.
- `GET/POST /api/tag-preferences` + `DELETE /api/tag-preferences/[label]` — cap 100, upsert na POST.
- `POST/DELETE /api/messages/[id]/sent-irl` — só aceita `sender = user`; multi-tenancy via `contact.userId`.

### Store Zustand (v8 — invalida cache pre-W8)
- Estado novo: `folders`, `tagPreferences`, `selectedFolderId`, `showArchived`, `pendingArchiveUndo`
- Actions: pinContact, unpinContact, archiveContact, restoreContact, moveContactToFolder, createFolder, updateFolder, deleteFolder, selectFolder, toggleArchivedView, setTagPreference, removeTagPreference, markMessageSentIrl, clearArchiveUndo
- Bootstrap paraleliza 3 fetches via `Promise.all`. Tolerante a falha em folders/tagPrefs (continua com array vazio).
- Optimistic updates em todas as actions de mutação, rollback no client em caso de !res.ok.

### UI — componentes novos em `src/components/sidebar/`
- `<SidebarFilterBar/>` — chips "Tudo" · badge de count fixados · pastas (cor tinge chip ativo) · "Arquivados" toggle. Mobile: scroll horizontal `overflow-x-auto scrollbar-none`.
- `<ContactContextMenu/>` — dropdown via `<DropdownMenu render={trigger}>` (não `asChild` — base-ui não suporta). Estados internos: showFolderPicker / confirmDelete. Folder picker inline com check ✓ na pasta atual.
- `<FolderManagerModal/>` — modal de CRUD. Palette de 8 cores AILA (#ff355d, #ff8a9e, #f59e0b, #10b981, #06b6d4, #8b5cf6, #ec4899, #94a3b8). Edit inline; confirm delete inline.
- `<TagManagerModal/>` — agrega tags via `Contact.tags[]` (filtra archived). Conta uso. Mesma palette do FolderManager (H4 Nielsen — consistência).
- `<ArchiveUndoToast/>` — fixed bottom-center. Barra de progresso linear via `requestAnimationFrame`. Auto-dismiss via `onDismiss` callback quando progress chega a 0.

### UI — shell (flirt-ai-shell.tsx)
- `visibleContacts` pipeline: archive gate → folder filter → search filter → sort (pinned DESC, updatedAt DESC).
- Counters (`pinnedCount`, `archivedCount`) calculados via `React.useMemo` sobre todos os contacts (não só os filtrados).
- `tagColorByLabel: Map<string, string>` montado uma vez por mudança em `tagPreferences`.
- ContactCard convertido de `<button>` pra `<div role="button">` pra permitir ContextMenu nested. Keyboard nav preservada via `onKeyDown` em Enter/Space.
- Pin icon (Lucide PinIcon) visível à esquerda do nome quando `pinnedAt` set.
- Até 3 tag chips coloridos por card; chip neutro quando sem TagPreference; "+N" overflow.
- Footer da sidebar ganha "Gerenciar tags coloridas".
- User bubble: toggle "Marcar como enviado" / "Enviei" (verde quando set) no canto direito, ao lado do timestamp.

### UI — desenrolos/[id]/page.tsx
- `<Tabs>` (`@base-ui/react/tabs` via shadcn) wrappa `ContactSignalsPanel` + `EncounterTimeline`. Triggers "Sinais" e "Encontros (count)". Variant `line` pra ficar discreto. Botão "Novo encontro" mantido dentro do TabsContent encontros.

## Build gates

- `npx prisma format` + `prisma validate` → ok
- `npx prisma migrate dev` → migration aplicada
- `npx prisma generate` → client regenerado
- `npx tsc --noEmit` → exit 0
- `npm run lint` → 0 erros (4 warnings pré-existentes, não meus)
- `npm run build` → standalone bundle ok. Todas as 7 rotas novas listadas como ƒ.

## Decisões registradas

### DEC-W8-01: Tags ficam como `String[]` (não junction table)
**Trade-off**: junction (TagModel + ContactTag) é mais "normalizado", mas o LLM escreve tags via tool_use no `/api/coach` dentro de `prisma.$transaction([create user msg, create assistant msg, update Contact])`. Mudar pra junction quebraria a transação atômica (precisaria inserir N rows na junction num passo separado, possível inconsistência se falhar).
**Solução**: `Contact.tags: String[]` continua autoridade. `TagPreference` é só mapa user-curado label → cor. Tag sem entrada = chip neutro.

### DEC-W8-02: Cap PINNED em transação
**Problema**: race quando user clica pin em dois cards quase simultâneo — count poderia ser 5 nos dois reads, gerar 6 pinned.
**Solução**: `prisma.$transaction(async (tx) => { count + update })` em `pin/route.ts`. Throw `"PINNED_CAP"` se count >= 5 — handler converte em 409 com `code` pra UI mostrar mensagem custom.

### DEC-W8-03: Archive limpa pin
**Razão**: contato arquivado não pode estar "pinned no topo da lista" — não aparece na lista padrão. Manter `pinnedAt` poderia surpreender (user restaura, contato volta pinned do nada).
**Solução**: `archive` POST faz `{ archivedAt: now, pinnedAt: null }`. Restore não reativa pin (intencional — user decide).

### DEC-W8-04: ContactCard `<div role="button">` em vez de `<button>`
**Problema**: nested interactive elements (button dentro de button) é violação HTML + warning React.
**Solução**: wrapper `<div>` com `role="button"`, `tabIndex={0}`, `onKeyDown` pra Enter/Space. DropdownMenu trigger fica como `<button>` válido dentro.

### DEC-W8-05: Toast undo 10s vs Bin tab
**Comparação**: Bin tab (Gmail) requer query separada + delete cron. Toast (Telegram) é instant rollback no client + 1 chamada de API extra opcional.
**Escolha**: toast — mais leve, sem cron necessário, padrão familiar mobile.

## Smoke E2E — Meres precisa rodar manualmente

Ver `docs/HANDOFF-W8.md` seção "Smoke criteria" — 6 passos cobrindo pin, pasta, archive (+undo), tag color, sent-irl, timeline tab.

## Pendências pós-W8

- **CRÍTICO**: smoke manual antes de deploy
- W8.1 sugestões: drag-and-drop folder reorder, bulk actions, search em mensagens, snooze por contato

## Commits

- `bbb28b0 feat(flirtai): W8 Org & Hygiene — schema + API + store`
- `6b4a759 feat(flirtai): W8 Org & Hygiene UI — sidebar, modais e timeline tab`
