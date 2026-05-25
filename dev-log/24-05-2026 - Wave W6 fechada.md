---
alias: 24-05-2026 - Wave W6 fechada
type: dev-log
tags: [flirtai, wave/W6, user-profile, memoria-do-homem, onboarding, feedback-loop]
date_e_hora: 24-05-2026
projeto: flirtai
mci_versao: v7.7
---

# Wave W6 fechada — Memória do Homem (UserProfile)

## TL;DR

- ✅ **Memória do Homem** entregue end-to-end: schema, migration, 3 endpoints, biblioteca de me-context, integração no `/api/coach`, página `/me`, wizard 6-perguntas full-screen + modal pós-signup + banner CTA + feedback inline em SuggestionCard.
- ✅ Build verde, typecheck verde, lint sem regressão (28 rotas, +3 de W5).
- ⚠️ Migration não aplicada localmente (docker faltando no host) — roda no próximo `prisma migrate deploy` em prod.
- ⚠️ Smoke E2E real e validação Langfuse pendentes (Meres).

## Decisões da wave

1. **Onboarding via 3 pontos de entrada** — modal pós-signup auto-abre (sessionStorage-guarded) + banner CTA persistente no shell (localStorage 7d) + página dedicada `/me/onboarding`. Wizard compartilhado entre modal e página.
2. **Tone resolution `userProfile?.tone ?? user.coachTone ?? null`** — W6 override fino > W5 default global. Não quebra W5; é só uma camada adicional. Resolvido em runtime no `/api/coach`.
3. **Sem classificador Haiku** — decisão explícita: feedback negativo grava raw em `redPatternsRaw` (cap 200), positivo grava raw em `winSamples` (cap 100). W8 vai consolidar via WeeklyDigest. Trade-off: economia imediata de custo + simplicidade, ao preço de 1 wave de delay no efeito visível.
4. **`buildMeContext` é cache_control: ephemeral em bloco separado** — Anthropic suporta múltiplos breakpoints de prompt cache. Base estável cross-user + me-context per-user cached independentemente.

## Surpresas

- SuggestionCard precisou virar `<div>` com `<button>` interno pra permitir nested feedback buttons sem violar HTML. Click-to-fill preservado.
- Cap de render (12 itens cada lista) ≠ cap de storage (100/200). Histórico longo pra W8 processar, prompt enxuto pra economia de token.
- Bug Prisma.DbNull do W5 reapareceu: PATCH com `null` em JSON column precisa converter manualmente.

## Próximo

- W7 — Diário de Campo (EncounterLog). Integração com `UserProfile.redPatterns` quando user repete padrão problemático.
- Validar Langfuse: 2 prefixos cached separados (base + me-context).
- Instalar Docker no host (ou Postgres standalone) pra destravar migrations dev locais.

## Auto-handoff (carregar próxima sessão)

```
cd /Users/raphaelmeres/MeresOS/MeresClaude/projetos/flirtai
@docs/HANDOFF-W6.md
@docs/ROADMAP.md

Próxima wave: W7 — Diário de Campo (EncounterLog). 3-4 dias. Bloqueada por nada (W6 done).

Leia HANDOFF-W6 §"Próximas ações" e §"Guard-rails" antes de codar.
Esqueme do EncounterLog está no ROADMAP §W7. Schema-First + Component-First obrigatórios antes da 1ª linha.
```
