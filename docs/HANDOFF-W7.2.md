---
alias: HANDOFF-W7.2-flirtai
type: handoff
status: closed
projeto: flirtai
wave: W7.2
documento: HANDOFF-W7.2
data: 25-05-2026
mci_versao: v7.7
tags: [flirtai, wave/W7.2, hotfix, ux-polish, nielsen]
---

# HANDOFF W7.2 — UX Polish (Logout + Nome no Picker + Tooltip)

## Status

**Fechada** em 25-05-2026 na mesma sessao que W7.1 e W7.3.

## O que foi entregue

### Gap #2 — Botao "Sair" no rodape da sidebar

- Imports adicionados em [src/components/flirt-ai-shell.tsx](src/components/flirt-ai-shell.tsx): `LogOutIcon` (Lucide) + `signOut` ([src/lib/auth-client.ts:9](src/lib/auth-client.ts#L9)).
- Estado `isSigningOut` + handler `handleLogout` dentro de `ConversationSidebar`.
- Botao com `<LogOutIcon />` + texto "Sair" / "Saindo..." (spinner) no rodape com `sticky bottom-0` + `border-t border-white/10` + `backdrop-blur-xl`.
- Touch target **44px** (`min-h-[44px]`), `aria-label="Sair da conta"`, hover rose (`hover:border-rose-300/30`).
- Funciona em **desktop** (sidebar fixa) **e mobile** (drawer animado).
- Fluxo: chama `signOut()` (better-auth) → fallback `window.location.href = "/login"` mesmo se der erro pra garantir saida.

### Gap #3 — Input "Nome dela" no `NewConversationPicker`

- Picker refatorado de DropdownMenu c/ DropdownMenuItem pra DropdownMenu c/ form inline:
  - Input `<input autoFocus maxLength={80}>` com placeholder "Ex: Bia".
  - Helper text 3-estados: "Digite o nome dela pra comecar." / "Pode ajustar depois." / "Maximo 80 caracteres."
  - Botao "Criar desenrolo" — **disabled** se nome vazio ou >80 chars.
  - Botao "Criar chat com agente" — nome opcional (so disabled se >80 chars), preserva o flow auto-gerado pra agent_chat.
  - ENTER no input submete "Criar desenrolo" (atalho power user).
- `handleCreate` extendido pra receber `(kind, name?)`:
  - `desenrolo` com nome → POST `/api/contacts` direto via `createContact({kind, name})` → `router.push("/desenrolos/[id]")`.
  - `desenrolo` sem nome → fluxo antigo `/desenrolos/new` (form completo).
  - `agent_chat` com ou sem nome → cria direto.
- Bug colateral corrigido: desktop sidebar usava `onCreateContact={() => createContact()}` (ignorava `kind`). Agora usa `onCreateContact={handleCreate}` igual ao drawer mobile e ao header.
- Removido import nao usado `DropdownMenuItem`.

### Gap #5 — Tooltip "+ Como foi?"

- `+ Como foi?` no header sticky de `/desenrolos/[id]` envolvido em `<Tooltip>` (`@/components/ui/tooltip.tsx`, base-ui Radix).
- Conteudo PT-BR: **"Registre o que rolou no ultimo encontro. A IA extrai sinais."**
- `TooltipProvider delay={150}` — aparece em hover (desktop) e long-press (mobile, comportamento padrao do Radix).
- Botao continua acessivel via teclado; tooltip nao quebra ENTER/SPACE.

## Done Criteria — verificacao

| # | Criterio | Resultado |
|---|---|---|
| 1 | Sair na sidebar/drawer com LogOut Lucide | PASS |
| 2 | `signOut()` + redirect `/login` | PASS — com fallback `window.location.href` se erro |
| 3 | Loading state disabled + spinner | PASS — `isSigningOut` controla |
| 4 | Mobile touch target ≥44px no rodape | PASS — `min-h-[44px]` + `sticky bottom-0` |
| 5 | "Nome dela" antes do CTA | PASS |
| 6 | Validacao client (trim, 1..80 chars) | PASS — `trimmed.length === 0` ou `>80` desabilita |
| 7 | agent_chat aceita nome vazio | PASS |
| 8 | POST `/api/contacts` passa name | PASS — via `createContact({kind, name})` |
| 9 | Redirect `/desenrolos/[id]` com nome certo | PASS — `router.push` apos `createContact` |
| 10 | Tooltip envolve "+ Como foi?" | PASS |
| 11 | Conteudo PT-BR correto | PASS — "Registre o que rolou no ultimo encontro. A IA extrai sinais." |
| 12 | Hover desktop + long-press mobile | PASS — Radix delay 150ms |
| 13 | Lint + typecheck verdes | PASS |
| 14 | Nielsen H4/H5/H6/H7/H10 revisitados | PASS — sem BLOCK |

## Smoke Criteria

```
1. Logado em /. Clicar "Sair" no rodape da sidebar.
   → Botao mostra "Saindo..." + spinner.
   → Cookie `better-auth.session_token` removido (DevTools > Application).
   → Redirect /login em <2s.

2. Mobile viewport 320: abrir drawer (hamburguer). "Sair" visivel no rodape.

3. Clicar `+` na sidebar → picker abre com input "Nome dela" autofocus.
   → Digitar "Bia Smoke 2" → CTA "Criar desenrolo" habilita.
   → Submit → sidebar mostra "Bia Smoke 2" imediatamente. URL = /desenrolos/<id>.

4. Campo vazio + tentar "Criar desenrolo" → botao disabled, helper "Digite o nome dela pra comecar."

5. Campo vazio + "Criar chat com agente" → cria agent_chat com nome auto-gerado.

6. Hover sobre "+ Como foi?" no /desenrolos/[id] → tooltip com texto correto em ~150ms.
```

## Arquivos tocados

- `src/components/flirt-ai-shell.tsx` (M) — `+ LogOutIcon` import, `+ signOut` import, `- DropdownMenuItem` import, `handleCreate(kind, name?)` extendido, desktop sidebar passa `handleCreate`, `ConversationSidebar` ganha logout no rodape, `NewConversationPicker` refatorado pra form inline.
- `src/app/desenrolos/[id]/page.tsx` (M) — `+ Tooltip imports`, "+ Como foi?" wrapado em `<TooltipProvider><Tooltip><TooltipTrigger render={...} /><TooltipContent>...</TooltipContent></Tooltip></TooltipProvider>`.

**Sem migration, sem endpoint novo, sem mudanca de schema.**

## Guard-rails respeitados

- Nao refatorou `flirt-ai-shell.tsx` em multiplos arquivos — picker e sidebar continuam no monolito (CLAUDE.md L46-49).
- Nao substituiu `NewConversationPicker` — extendeu pra ter input + 2 CTAs.
- Nao adicionou tooltips em outros botoes — escopo limitado.
- `signOut()` aguarda promise antes do fallback redirect; nao bloqueia se 5xx.
- Mobile-first preservado: rodape sticky, touch target 44px, input autofocus.

## Bug bonus corrigido

Desktop sidebar tinha `onCreateContact={() => { void createContact(); }}` que ignorava completamente `kind` e criava contato sem nome. Trocado por `handleCreate` (igual ao mobile drawer + header). Esse era o caminho real que produzia "Perfil sem nome" reportado no smoke — agora tanto desktop quanto mobile passam pelo picker com nome.

## Proxima acao

W7.3 fechada na mesma sessao. Smoke re-rodada manual recomendada (1 sessao a~5min). W8 (Painel Status do Jogo) destrava — UI agora mais polida pra apresentacao.
