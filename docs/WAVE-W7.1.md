---
alias: WAVE-W7.1-flirtai
type: wave-spec
status: pending
tags: [flirtai, wave/W7.1, hotfix, sinais-consolidados, schema-first]
date_e_hora: 25-05-2026
priority: critical
projeto: flirtai
documento: WAVE-W7.1
wave: W7.1 — Hotfix Sinais Consolidados do Contato
versao: 1.0
abre: 25-05-2026
estimativa: 1-2h
depende_de: W7
desbloqueia: percepcao do usuario que "front mostra tudo"
mci_versao: v7.7
---

# WAVE W7.1 — Hotfix Sinais Consolidados do Contato

## Por que existe

SMOKE-W7-DONE Bug #1 (CRITICO): `serializeContact` ([src/lib/serializers.ts:51-82](src/lib/serializers.ts#L51)) **nao retorna** `greenFlags` nem `redFlags`, apesar do DB persistir e do tipo `ContactRecord` ([src/types/flirt.ts:155-156](src/types/flirt.ts#L155)) declarar.

Consequencia: o trabalho de W6 (Memoria do Homem) + W7 (EncounterLog) acumula sinais por contato mas **nenhum lugar da UI mostra os arrays consolidados**. Aparece so dentro de cada `EncounterCard` individual. O Meres reportou explicitamente: "front nao mostra todas as funcoes".

## Escopo

Tudo que envolve **mostrar `greenFlags` + `redFlags` do Contact** ponta a ponta.

**Esta wave NAO faz:**
- Novo schema (campos ja existem).
- Editar/deletar flags manualmente (append-only, herdado de W7).
- Agrupar flags por encounter de origem (futuro).
- Mexer em `attractionLevel`, `personalityType`, `tags`, `interests` (ja serializados).

## Done Criteria (testavel)

1. **Serializer corrigido** — `serializeContact` retorna `greenFlags: string[]` e `redFlags: string[]` (vazio se null no DB).
2. **API contract** — `GET /api/contacts` e `GET /api/contacts/[id]` retornam ambos os arrays. `curl | jq '.greenFlags, .redFlags'` retorna arrays (nunca `null`).
3. **UI no detalhe do contato** — `/desenrolos/[id]` tem secao "Sinais da {nome}" entre o read view e a timeline do Diario de Campo, com:
   - chips emerald (greenFlags) e rose (redFlags) usando os mesmos tokens do `EncounterCard`
   - contador "{N} sinais positivos / {M} sinais a observar" no header da secao
   - empty state PT-BR ("Nenhum sinal registrado ainda. Use Como foi? pra alimentar.")
4. **Reflexo no Zustand** — `applyCoachResponse` e o refresh pos-encounter ja propagam o objeto Contact, entao as flags atualizam sem F5.
5. **Mobile-first** — chips quebram em flex-wrap em viewport 320, sem overflow horizontal.
6. **Nielsen H4 + H8** — consistencia visual com chips de tag ja existentes; hierarquia clara (1 secao por contato, nao por encounter).
7. **Lint + typecheck verdes** — `npm run lint` 0 errors / `npx tsc --noEmit` 0 errors. Os 2 warnings pre-existentes da W3+W4 podem persistir.

## Arquivos tocados

| Arquivo | Acao |
|---|---|
| `src/lib/serializers.ts` | Edit — adicionar `greenFlags` + `redFlags` no return |
| `src/components/contact/contact-signals-panel.tsx` | NEW — componente reutilizavel `<ContactSignalsPanel contact={contact} />` |
| `src/app/desenrolos/[id]/page.tsx` | Edit — inserir `<ContactSignalsPanel />` entre read view e timeline |
| `docs/COMPONENT-MAP.md` | Edit — append secao "Wave 7.1" |

**Sem migration, sem novo schema, sem novo endpoint.**

## Smoke Criteria

1. Logar como user com 1 contato + 2 encounters salvos. Abrir `/desenrolos/[id]`. Ver secao "Sinais da {nome}" com chips emerald e rose. Conta bate com a soma do que aparece em cada `EncounterCard`.
2. `curl -b cookie http://localhost:3000/api/contacts/<id> | jq '.greenFlags | length'` retorna numero > 0 (nao null).
3. Submeter novo encounter via modal "+ Como foi?" com texto contendo flag clara ("ela tomou iniciativa", "ela demorou pra responder"). Apos sucesso, a secao "Sinais" da contagem +1 sem F5.
4. Empty state visivel em contato novo sem encounters.
5. Viewport 320x568 — sem scroll horizontal, chips em flex-wrap.

## Guard-rails

- **Nao fazer dedup novo** — `mergeDedupCap` ja roda no `/api/contacts/[id]/encounters` (W7). Serializer apenas le.
- **Nao expor `greenFlags`/`redFlags` em endpoint publico/non-auth** — proteger via `requireUser()` que ja existe nas rotas `/api/contacts/*`.
- **Manter cap 12** do array no DB (W7 ja aplica). Se renderizar > 12 chips, e bug em outro lugar.
- **Nao mexer em `EncounterCard`** — ele continua mostrando flags do encounter individual. Esta wave mostra o **consolidado** do contato, complementar.
- **Naming Lock:** TS `greenFlags` / `redFlags` camelCase, DB `green_flags` / `red_flags` snake_case via `@map` ja existente em `schema.prisma`.

## Riscos

| Risco | Impacto | Mitigacao |
|---|---|---|
| Quebra contrato pra clients que esperam ausencia dos campos | Baixo (so o shell consome) | TS strict pega no build |
| Performance se contato tiver 100+ flags | Baixo (cap 12 do W7) | n/a |
| Inconsistencia visual com chips de tags ja existentes | Medio | Reusar mesma classe de tag do flirt-ai-shell |

## Proxima acao (executar)

1. Edit `src/lib/serializers.ts` — adicionar 2 linhas no return.
2. Smoke local: `curl ... | jq` confirmar arrays presentes.
3. Criar `<ContactSignalsPanel />` standalone.
4. Inserir no `desenrolos/[id]/page.tsx`.
5. Manual test no browser (mobile + desktop).
6. `npm run lint && npx tsc --noEmit`.
7. Commit `fix(flirtai): expose greenFlags/redFlags + ContactSignalsPanel (W7.1)`.
8. Atualizar `docs/COMPONENT-MAP.md` + `docs/ROADMAP.md` + gerar `HANDOFF-W7.1.md`.
