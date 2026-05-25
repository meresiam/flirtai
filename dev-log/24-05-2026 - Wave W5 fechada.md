---
alias: dev-log-flirtai-W5
type: dev-log
status: done
tags: [flirtai, wave/W5, dev-log, settings, search, coach-tone]
date_e_hora: 24-05-2026
projeto: flirtai
documento: dev-log Wave 5
wave: W5 — Settings & Search expandidos
mci_versao: v7.7
---

# Dev-log — Wave W5 fechada (24-05-2026)

## Entregue

- **M5 — Search server-side em `/api/contacts?q=`** com `ilike` em `name`/`instagramHandle`/`location`/`metContext` + `has` em `tags`. Bounded por `take: 500` e `SEARCH_QUERY_MAX=80`.
- **M5 — Cliente debounce 250ms** em `desenrolos/page.tsx` com `AbortController` + spinner inline. Cache Zustand preservado pro estado sem query.
- **M8 — Migration `add_user_preferences`** (`User.timezone`/`locale` TEXT, `coachTone` enum `CoachTone`, `notificationPrefs` JSONB — todos nullable).
- **M8 — Settings UI expandido** com 5 sections (Perfil · Conta · Coach · Notificações · Anthropic API), tudo refatorado com `<SectionCard>`/`<Field>`/`<PrimaryButton>` reutilizáveis e min-h 44px em CTAs.
- **M8 — `coachTone` no system prompt** via `buildSystemPrompt(mode, tone?)` + 3 addenda PT-BR (low-key / direto / provocador). `/api/coach` carrega o campo no mesmo `Promise.all` (zero round-trip extra).
- **Docs:** DATA-MODEL.md (User + migration history) + COMPONENT-MAP.md (section W5) + HANDOFF-W5.md completo.

## Gates

- `npx tsc --noEmit` exit 0
- `npm run lint` 0 erros (1 warning pré-existente em `meta-graph-client.ts:17`, W4 stub)
- `npm run build` standalone, 25 rotas
- `EXPLAIN ANALYZE` da query de search em 8 rows: 0.117ms (gate <100ms confortável)

## Achados

- **Hook de format reverteu `/api/coach/route.ts` no meio da edição.** Reaplicado em 2 edits sequenciais. Investigar `format-on-edit` em sessão futura — pode estar lendo versão estale do disco quando dispara em arquivo paralelo.
- **`Prisma.DbNull` obrigatório pra limpar JSON.** `null` puro vira "skip" em Prisma update; pattern correto documentado em `/api/settings/route.ts:127-130`.
- **Lint `react-hooks/set-state-in-effect` bloqueou setState síncrono** no clear de search. Refatorado pra derivar via `hasActiveSearch ? serverResults : cachedContacts` no `useMemo` — estado só é setado pelo branch de fetch success.
- **Coach tone radio salva on-change**, sem botão "Salvar". Decisão de UX: tom é low-stakes, sempre reversível.

## Débitos abertos

- Smoke E2E manual (8 critérios em HANDOFF-W5) ainda não rodado por Meres.
- 5 FLAGs Nielsen do ConsentDialog (W4) continuam abertos.
- Push notifications: shape persiste mas canal de entrega não existe.
- `pg_trgm` não habilitado (não necessário enquanto contagem <10k/user).

## Próxima wave: **W6 — Memória do Homem (UserProfile)**

Roadmap aponta W6 como dependente de W5 (Track C: W5 → W6 → W8). Resolução de tone no coach deve passar a ser: `UserProfile.tone > User.coachTone > null`. Detalhes em ROADMAP.md W6.
