---
alias: WAVE-W7.2-flirtai
type: wave-spec
status: pending
tags: [flirtai, wave/W7.2, hotfix, ux-polish, nielsen]
date_e_hora: 25-05-2026
priority: high
projeto: flirtai
documento: WAVE-W7.2
wave: W7.2 — UX Polish (Logout + Nome + Tooltip)
versao: 1.0
abre: 25-05-2026
estimativa: 1-2h
depende_de: W7.1 (mesma sessao ok)
desbloqueia: percepcao de "produto acabado"
mci_versao: v7.7
---

# WAVE W7.2 — UX Polish (Logout + Nome + Tooltip)

## Por que existe

3 gaps de UX pequenos, todos descobertos no SMOKE-W7-DONE e impactando heuristicas de Nielsen:

- **Gap #2** — Botao "Sair" so existe em `/settings`. Quebra H6 (reconhecimento) + H7 (eficiencia). Usuario novo perde tempo procurando.
- **Gap #3** — Botao `+` no shell abre `NewConversationPicker` (tipo de conversa) e cria contato sem campo de nome. Sidebar mostra "Perfil sem nome" temporariamente. Quebra H5 (prevencao de erro).
- **Gap #5** — Botao "+ Como foi?" sem tooltip. Quebra H10 (ajuda). Ja flagado no HANDOFF-W7 como aceitavel; fix < 10min.

Cada um sozinho nao bloqueia ninguem, mas juntos compoem a sensacao de "produto incompleto" que o Meres reportou.

## Escopo

Tres fixes de UI no shell + picker + modal de encounter. Sem schema, sem API.

**Esta wave NAO faz:**
- Refactor do `flirt-ai-shell.tsx` (monolito intencional).
- Mexer no roteamento auth (proxy.ts e' tema W7.3).
- Adicionar tooltips em todos os outros botoes (so o + Como foi?).

## Done Criteria (testavel)

### Logout (Gap #2)
1. Sidebar do `flirt-ai-shell.tsx` (desktop) e drawer mobile tem botao "Sair" no rodape com icon `<LogOut />` da Lucide.
2. Clique chama `authClient.signOut()` (ja exportado de `src/lib/auth-client.ts`) → redirect `/login`.
3. Estado loading enquanto a request roda (disabled + spinner).
4. Mobile-first: touch target ≥44px, posicao no rodape do drawer.

### Nome no picker (Gap #3)
5. `NewConversationPicker` (componente atual) ganha campo "Nome dela" antes do CTA "Criar desenrolo" / "Criar agent chat".
6. Validacao client: trim, min 1 char, max 80 chars. Submit disabled se vazio.
7. Campo opcional vazio nao bloqueia se o tipo for `agent_chat` (mantem default auto-gerado pra fluxo de IA).
8. POST `/api/contacts` passa o `name` digitado. Backend ja aceita (W1).
9. Apos criar, redireciona pro `/desenrolos/[id]` com o nome certo na sidebar.

### Tooltip (Gap #5)
10. Botao "+ Como foi?" no header sticky de `/desenrolos/[id]` envolvido em `<Tooltip>` (shadcn ja instalado).
11. Conteudo PT-BR: "Registre o que rolou no ultimo encontro. A IA extrai sinais."
12. Aparece em hover (desktop) e long-press (mobile, comportamento padrao do Radix Tooltip).

### Gates gerais
13. `npm run lint` 0 errors / `npx tsc --noEmit` 0 errors.
14. Nielsen revisitado (H4 H5 H6 H7 H10) — checklist no SMOKE refresh.

## Arquivos tocados

| Arquivo | Acao |
|---|---|
| `src/components/flirt-ai-shell.tsx` | Edit — botao Sair no rodape da sidebar/drawer |
| `src/components/new-conversation-picker.tsx` (path provavel) | Edit — input "Nome dela" + validacao |
| `src/app/desenrolos/[id]/page.tsx` | Edit — wrap "+ Como foi?" em `<Tooltip>` |
| `src/components/ui/tooltip.tsx` | Provavelmente ja existe via shadcn; senao `npx shadcn add tooltip` |

**Sem migration, sem novo endpoint.**

## Smoke Criteria

1. **Logout**: logado em `/`, clicar "Sair" no rodape da sidebar → toast "Saindo..." → redirect `/login` em <2s. Cookie `better-auth.session_token` removido (DevTools > Application > Cookies).
2. **Logout mobile**: viewport 320, abrir drawer (hamburguer), "Sair" visivel no rodape.
3. **Nome no picker**: clicar `+` na sidebar → picker abre → digitar "Bia Smoke 2" no campo "Nome dela" → CTA "Criar desenrolo" habilita → submit → sidebar mostra "Bia Smoke 2" imediatamente (sem placeholder).
4. **Nome vazio**: campo vazio + CTA → botao disabled, helper text "Digite o nome dela pra comecar."
5. **Tooltip**: hover sobre "+ Como foi?" → tooltip aparece com texto certo em <200ms.

## Guard-rails

- **NAO refatorar `flirt-ai-shell.tsx`** — 1300 linhas e monolitico por design (CLAUDE.md L46-49). Adicionar botao logout dentro, nao quebrar em componentes.
- **NAO substituir `NewConversationPicker`** por outro componente — extender.
- **NAO adicionar tooltips em outros botoes nesta wave** — escopo limitado, evita bikeshed.
- **`authClient.signOut()` retorna promise** — aguardar antes do redirect manual; se 5xx, fallback `window.location.href = "/login"`.
- **Mobile-first**: testar viewport 320 antes de fechar.

## Riscos

| Risco | Impacto | Mitigacao |
|---|---|---|
| Drawer mobile esconde "Sair" abaixo do fold em telas curtas | Medio | `sticky bottom-0` no container do rodape |
| Tooltip em mobile interfere com tap do botao | Baixo | Radix ja resolve via `delayDuration` |
| Input "Nome dela" quebra layout do picker existente | Baixo | adicionar antes do CTA com gap-2 |

## Proxima acao (executar)

1. Identificar path exato do `NewConversationPicker` (procurar import em `flirt-ai-shell.tsx`).
2. Edit shell — botao logout no rodape.
3. Edit picker — input + validacao + passar `name` no POST.
4. Edit `desenrolos/[id]` — wrap tooltip.
5. Manual test (logout / criar / hover).
6. `npm run lint && npx tsc --noEmit`.
7. Commit `feat(flirtai): logout no shell + nome no picker + tooltip Como foi (W7.2)`.
8. Atualizar `docs/COMPONENT-MAP.md` + gerar `HANDOFF-W7.2.md`.
