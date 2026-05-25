---
alias: prompt-handoff-flirtai-W5
type: prompt-handoff
status: ativo
tags: [flirtai, wave/W5, handoff-prompt, settings, search]
date_e_hora: 24-05-2026
priority: high
projeto: flirtai
wave: W5 — Settings & Search expandidos
mci_versao: v7.7
---

# Prompt de Handoff — W5 (Settings & Search expandidos)

Projeto flirtai em `/Users/raphaelmeres/MeresOS/MeresClaude/projetos/flirtai`.

Antes de qualquer codigo, leia obrigatoriamente:
1. `/Users/raphaelmeres/MeresOS/MeresClaude/projetos/flirtai/CLAUDE.md` — stack, convencoes, naming lock
2. `/Users/raphaelmeres/MeresOS/MeresClaude/projetos/flirtai/docs/ROADMAP.md` — W5 escopo (M5 + M8) + dependencias
3. `/Users/raphaelmeres/MeresOS/MeresClaude/projetos/flirtai/docs/HANDOFF-W4.md` — guard-rails e debitos ativos
4. `/Users/raphaelmeres/MeresOS/MeresClaude/projetos/flirtai/docs/NIELSEN-CHECKLIST-w4-reaccept.md` — 5 FLAGs pendentes que podem ser fechados em W5 como quick-fixes

Wave a atacar: **W5 — Settings & Search expandidos**.

Escopo:
- M5: `GET /api/contacts?q=` server-side com ilike + debounce 250ms no cliente (substitui filtro client-only em `desenrolos/page.tsx`)
- M8: `/settings` ganha secoes Conta (timezone, idioma), Coach (coachTone: low-key|direto|provocador), Notificacoes (push on/off), API & Modelo (ja existe)
- Migration `add_user_preferences` obrigatoria antes de codar UI
- `coachTone` deve ser consumido em `buildSystemPrompt()` em `src/lib/flirt/system-prompt.ts`

Pre-condicao: Meres precisa ter rodado o smoke manual dos 7 criterios do HANDOFF-W4 antes de comecar W5.

Gate de saida W5: busca em 500 contatos < 100ms + settings persistem + coachTone impacta system prompt (verificar Langfuse) + Nielsen H1-H10 PASS + MOBILE-FIRST PASS.
