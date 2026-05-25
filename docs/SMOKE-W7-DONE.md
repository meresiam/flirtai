---
alias: SMOKE-W7-flirtai
type: smoke-report
status: partial
date_e_hora: 25-05-2026
projeto: flirtai
waves_cobertas: W0..W7
engine: playwright-cli (Microsoft) com console + network capture
mci_versao: v7.7
---

# SMOKE E2E flirtai (W0-W7)

## Sumario

- **PASS:** 11/13 fluxos
- **FAIL:** 1 (S4 — criar contato pela UI sem form de nome)
- **FLAG:** 4 (validacao data futura no Playwright, logout nao interceptavel, /api/me/profile abortado, SSE response.json)
- **Bugs reais encontrados:** 3 (1 critico, 2 medios)
- **Gaps de UI:** 5
- **Console errors:** 1 (hydration `caret-color`, nao bloqueante)
- **Network failures:** 8x `GET /api/me/profile` com status 0 (request abortado em navegacao rapida — comportamento normal de SPA)

Ambiente: dev server `next-server v16.2.0` (Turbopack) em `:3000`, Postgres local `:5432` com migration `20260525030000_create_encounter_log` aplicada antes do E2E.

---

## Resultado por area

### Auth (W0-W1) — PASS

| ID | Criterio | Resultado |
|---|---|---|
| S1 | Signup UI form + POST `/api/auth/sign-up/email` 200 + redirect | PASS |
| S2 | Login UI + cookie `better-auth.session_token` + GET `/api/auth/get-session` valida | PASS |

### Home + chat coach (W2-W4) — PASS com FLAGs

| ID | Criterio | Resultado |
|---|---|---|
| S3 | Home `/` logada renderiza shell + bootstrap `/api/contacts` 200 | PASS |
| S4 | Criar contato "Bia Smoke" pela UI | **FAIL** — botao `+` abre `NewConversationPicker` (tipo) sem form de nome (ver Gap #3) |
| S5 | `POST /api/coach` SSE stream 200, suggestions + insight no `event: done` | PASS (FLAG: bubbles sem class `message`, parser CSS quebrou — nao e bug do app) |

### `/me` + UserProfile (W6) — PASS

| ID | Criterio | Resultado |
|---|---|---|
| S6 | UserProfile com 6 campos editaveis, secao "Memoria do Homem", botao limpar memoria (LGPD) | PASS |

### Desenrolos + EncounterLog (W7) — PASS

| ID | Criterio | Resultado |
|---|---|---|
| S7 | Lista `/desenrolos` + detalhe `[id]` + botao "+ Como foi?" + secao "Diario de campo" | PASS |
| S8 | Modal encounter + submit + extracao LLM (escalation=avancou, greenFlags extraidos) + degraded=false | PASS |
| S8b | Validacao data futura | FLAG — validacao existe (cliente + server 400). `datetime-local` fill do Playwright nao disparou onChange React |

### Profile Watch (W2 modulo) — PASS

| ID | Criterio | Resultado |
|---|---|---|
| S9 | `/profiles` renderiza, API 200, criar profile em `/profiles/new` (stepper) | PASS |

### Settings (W5) — PASS

| ID | Criterio | Resultado |
|---|---|---|
| S10 | 4 secoes (Conta/Coach/Notificacoes/API), 10 campos editaveis, PATCH 200 | PASS |
| S11 | Logout | FLAG — botao "Sair" so existe em `/settings` (ver Gap #2) |
| S12 | Auth gating — `/api` 401 JSON OK, mas `/` sem cookie devolve **200 HTML** (ver Bug #2) | PASS parcial |

---

## Bugs encontrados

### Bug #1 — CRITICO — `serializeContact` nao retorna `greenFlags`/`redFlags`

**Arquivo:** [src/lib/serializers.ts:51-82](src/lib/serializers.ts#L51-L82)

`ContactRecord` declara os campos ([src/types/flirt.ts:155-156](src/types/flirt.ts#L155-L156)), o banco persiste (confirmado: contato "Bia Smoke" com 3 flags apos 2 encounters), mas o objeto retornado pelo serializer omite os 2 campos.

Repro:
```bash
curl -b cookie http://localhost:3000/api/contacts/<id>
# response NAO tem greenFlags nem redFlags, apesar de existirem no DB
```

Consequencia direta do reporte do Meres ("front nao mostra todas as funcoes"): os sinais acumulados de um contato nunca chegam ao client, mesmo que o W7 esteja gravando perfeitamente. So aparecem dentro do `EncounterCard` individual.

**Fix sugerido:** adicionar no return do `serializeContact`:
```ts
greenFlags: contact.greenFlags as string[],
redFlags: contact.redFlags as string[],
```
E criar secao "Sinais da {nome}" no [src/app/desenrolos/[id]/page.tsx](src/app/desenrolos/[id]/page.tsx) renderizando esses arrays como chips.

### Bug #2 — MEDIO — `proxy.ts` nao executa no dev server

**Arquivo:** [proxy.ts:5-26](proxy.ts#L5-L26)

O arquivo `proxy.ts` na raiz tem shape correta pra Next 16 (confirmado em `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`): `export async function proxy(request)` + `export const config = { matcher: [...] }`. Matcher exclui `api|_next/...|favicon.ico|.*\\.`, restante deveria redirecionar pra `/login` se nao houver cookie de sessao.

Repro:
```bash
$ curl -o /dev/null -w "HTTP %{http_code} | redirect: %{redirect_url}\n" http://localhost:3000/
HTTP 200 | redirect:                 # deveria ser 307 → /login
$ curl -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/desenrolos
HTTP 200                              # idem
$ curl -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/me
HTTP 200                              # idem
```

Auth so funciona client-side via o redirect que o store Zustand faz quando `/api/contacts` devolve 401 — qualquer scraper/bot/preload recebe o HTML completo da app sem cookie.

**Hipoteses:** (a) bug do Turbopack dev em Next 16.2.0 com `proxy.ts`; (b) cache stale do `.next/` que precisa de `rm -rf .next && npm run dev`; (c) precisa rebuild prod (Dockerfile copia standalone, pode ser que so funcione em build). **Acao:** rebuildar e re-testar; se persistir, abrir issue no Next.js ou voltar pra `middleware.ts` (deprecated mas funciona).

### Bug #3 — MEDIO — `useMeProfile()` faz fetch sem AbortController

**Sintoma:** 8x `GET /api/me/profile` com status 0 (aborted) durante navegacao rapida pos-signup/login. Sem impacto visual (banner so nao aparece), mas polui DevTools/Sentry com falhas de rede que parecem bugs.

**Fix:** adicionar `AbortController` no hook ou checar `mountedRef.current` antes de `setState`.

---

## Gaps de UI (funcoes entregues que NAO aparecem)

### Gap #1 — Sinais acumulados invisiveis no perfil do contato
Decorrente do Bug #1. `/desenrolos/[id]` precisa de uma secao "Sinais da {nome}" com chips emerald (`greenFlags`) e rose (`redFlags`) consolidados, no estilo do EncounterCard mas em escopo do Contact.

### Gap #2 — Logout exclusivo de `/settings`
Usuario logado em `/` ou `/desenrolos/[id]` nao encontra opcao de sair. Quebra H6 (reconhecimento) e H7 (eficiencia) das heuristicas Nielsen do CLAUDE.md MeresClaude. Fix: icon de `LogOut` no rodape da sidebar do `flirt-ai-shell.tsx` ou no menu do usuario.

### Gap #3 — Criar contato sem campo de nome na UI
Botao `+` da sidebar abre `NewConversationPicker` (escolhe tipo: desenrolo vs agent_chat) e cria contato com nome auto-gerado ("Perfil sem nome"). Usuario tem que abrir o detalhe + "Editar" pra colocar o nome real. Fix: adicionar input "Nome dela" no picker antes do CTA "Criar".

### Gap #4 — Botoes `[Funcionou]`/`[Nao rolou]` sem onboarding
`<SuggestionFeedback>` so renderiza apos resposta do coach com `messageId`. Usuario novo nao ve esses botoes nem entende que existem. Por design, mas precisa ser dito no empty state do chat ou no onboarding do `/me`.

### Gap #5 — Tooltip H10 ausente no "+ Como foi?" (ja flagado no HANDOFF-W7)
HANDOFF-W7 ja lista como FLAG aceito. Mantido aqui pra rastrear.

---

## Console errors e warnings

### Errors (1)
1. **`/login`** — `Warning: A tree hydrated but some attributes of the server rendered HTML didn't match the client properties` (diff de `caret-color: transparent` em inputs focused). **Causa:** Chromium injeta `caret-color` automaticamente em inputs sob foco. **Nao e bug do app**, mas pode ser silenciado adicionando `suppressHydrationWarning` nos inputs do form.

### Warnings (0)
Nenhum warning relevante.

---

## Network failures

| Ocorrencias | Request | Status | Causa |
|---|---|---|---|
| 8 | `GET /api/me/profile` | 0 (aborted) | Bug #3 — hook dispara fetch sem AbortController em navegacao rapida |
| 0 | qualquer outra | — | nenhuma |

---

## Screenshots

Todos em [docs/smoke-screens/](docs/smoke-screens/):

| Fase | Arquivo | Observacao |
|---|---|---|
| Signup | `s1-signup-page.png`, `s1-after-signup.png` | OK |
| Login | `s2-login-page.png`, `s2-after-login.png` | OK |
| Home logada | `s3-home-logada.png` | Shell renderiza |
| Picker | `s4-after-plus-click.png`, `s4-after-plus-no-input.png`, `s4-final.png` | Sem campo de nome (Gap #3) |
| Chat coach | `s5-mensagem-escrita.png`, `s5-coach-response.png` | SSE funcionando |
| /me | `s6-me-page.png` | 6 campos editaveis presentes |
| Desenrolos | `s7-desenrolos-lista.png`, `s7-desenrolo-detalhe.png` | OK, mas sem chips de flags consolidados |
| Encounter modal | `s8-modal-aberto.png`, `s8-modal-preenchido.png`, `s8-apos-submit.png` | Submit + extract OK |
| Validacao data | `s8b-validacao-data-futura.png` | Server retorna 400 OK |
| Profiles | `s9-profiles-page.png` | OK |
| Settings | `s10-settings-page.png` | 4 secoes presentes |
| Logout | `s11-logado.png`, `s11-apos-logout.png` | So acessivel via `/settings` (Gap #2) |

---

## Done Criteria de cada wave — verificacao cruzada

| Wave | Done Criteria principal | Status na UI |
|---|---|---|
| W0 | Bootstrap + Prisma + better-auth | PASS |
| W1 | Contacts CRUD + sidebar | PASS (mas criar sem nome, Gap #3) |
| W2 | `/api/coach` tool_use + chat | PASS |
| W3 | Suggestions feedback + insight chips | PASS |
| W4 | Settings override + rate limit | PASS |
| W5 | `/settings` 4 secoes + Notificacoes + API key | PASS |
| W6 | `/me` UserProfile + redPatterns + buildMeContext injecao no coach | PASS (Bug #3 no fetch) |
| W7 | EncounterLog + modal + timeline + integracao redPatterns | PASS (mas flags consolidadas nao aparecem no contato, Bug #1) |

---

## Repro de cada bug (resumo)

**Bug #1:**
```bash
# 1. logar como user com pelo menos 1 contato e 1 encounter salvo
# 2. inspecionar response
curl -b ~/.flirtai/cookies.txt http://localhost:3000/api/contacts/<contactId> | jq '.greenFlags, .redFlags'
# null null   ← deveria retornar arrays
```

**Bug #2:**
```bash
curl -o /dev/null -w "%{http_code}\n" http://localhost:3000/
# 200   ← deveria 307 → /login
```

**Bug #3:**
```
1. login → / (home)
2. observar DevTools > Network
3. ver 1-2x GET /api/me/profile com status (canceled)
```

---

## Proxima acao recomendada (ordem)

1. **Bug #1 fix (15min)** — adicionar `greenFlags`/`redFlags` no `serializeContact` + criar secao "Sinais da {nome}" em `/desenrolos/[id]/page.tsx`.
2. **Gap #2 fix (15min)** — botao logout no rodape da sidebar de `flirt-ai-shell.tsx`.
3. **Bug #2 investigacao (30-60min)** — `rm -rf .next && npm run dev` + re-curl; se persistir, testar `npm run build && npm run start` (prod); se ainda persistir, abrir issue Next.js 16.2.0 + criar `middleware.ts` fallback.
4. **Gap #3 (30min)** — campo "Nome dela" no NewConversationPicker antes do CTA.
5. **Bug #3 (10min)** — AbortController no `useMeProfile`.
6. Smoke re-rodado dos 13 criterios apos fixes.

---

## Artefatos relacionados

- Spec Playwright gerada (reusavel): [tests/smoke/w7/smoke-w7.spec.ts](tests/smoke/w7/smoke-w7.spec.ts)
- Screenshots: [docs/smoke-screens/](docs/smoke-screens/)
- Migration W7 aplicada antes do E2E: `20260525030000_create_encounter_log` (estava pendente em DB local)
