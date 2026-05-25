---
alias: WAVE-W7.3-flirtai
type: wave-spec
status: pending
tags: [flirtai, wave/W7.3, hotfix, auth-hardening, race-conditions]
date_e_hora: 25-05-2026
priority: high
projeto: flirtai
documento: WAVE-W7.3
wave: W7.3 — Auth Hardening + Race Fixes
versao: 1.0
abre: 25-05-2026
estimativa: 2-3h (1h investigacao proxy + 1-2h fix + smoke)
depende_de: independente (pode rodar em paralelo a W7.1/W7.2)
desbloqueia: deploy seguro em Coolify
mci_versao: v7.7
---

# WAVE W7.3 — Auth Hardening + Race Fixes

## Por que existe

Dois bugs do SMOKE-W7-DONE que **afetam producao** mesmo sem reclamacao visivel:

- **Bug #2 (MEDIO/CRITICO em prod)** — `proxy.ts` ([proxy.ts:5-26](proxy.ts#L5-L26)) tem shape correta de Next 16 (validado vs `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`) mas **nao executa no dev server Turbopack** — `GET /` sem cookie devolve **HTTP 200 HTML** em vez de 307 → /login. Crawlers/scrapers/bots recebem o HTML completo. Auth so funciona client-side via 401 do bootstrap.
- **Bug #3 (MEDIO)** — `useMeProfile()` (hook em `src/lib/use-me-profile.ts` provavel) dispara `GET /api/me/profile` no mount sem `AbortController`. Em navegacao rapida pos-signup/login a request e cancelada (status 0 no DevTools). 8 ocorrencias capturadas no smoke. Polui Sentry/observability com "failed" requests que sao apenas race normal de SPA.

## Escopo

Investigacao + fix de auth-gating server-side + fix de race no hook.

**Esta wave NAO faz:**
- Migrar pra middleware.ts SEM antes confirmar bug do proxy.ts (regressao consciente, registrar em ADR).
- Refatorar todos os hooks pra usar AbortController (so o `useMeProfile`).
- Adicionar testes E2E automatizados (smoke manual basta nessa wave).
- Mexer em better-auth (so como consumidor).

## Done Criteria (testavel)

### Bug #2 — proxy.ts auth gating
1. **Investigacao registrada** em `docs/ADR-007-proxy-vs-middleware.md`:
   - reproduzir bug com `rm -rf .next && npm run dev` (descartar cache stale)
   - testar com `npm run build && npm run start` (validar se e bug so do dev/Turbopack)
   - se persistir em prod, abrir issue no Next.js 16.2.0 ou Vercel/Next
   - decisao final: manter `proxy.ts` + esperar fix upstream, OU fallback `middleware.ts` com `export { proxy as middleware, config } from "./proxy"`
2. **`GET /` sem cookie devolve 307 → /login** em **prod build** (`npm run start`).
3. **`GET /api/contacts` sem cookie devolve 401 JSON** (ja funciona, manter).
4. **Login pos-redirect preserva `?redirect=/desenrolos/xyz`** (proxy.ts ja tem essa logica linha 19-21, validar fim a fim).

### Bug #3 — AbortController no useMeProfile
5. Hook `useMeProfile` (ou equivalente) usa `AbortController`:
   ```ts
   useEffect(() => {
     const ac = new AbortController();
     fetch('/api/me/profile', { signal: ac.signal })...
     return () => ac.abort();
   }, []);
   ```
6. Smoke: navegar de `/` → `/desenrolos` → `/me` em <1s — DevTools Network NAO mostra mais `GET /api/me/profile` com status 0/canceled.
7. Toast "erro ao carregar perfil" NAO aparece em navegacao rapida (catch ignora AbortError).

### Gates gerais
8. `npm run build` standalone verde (29 rotas, sem regressao).
9. `npx tsc --noEmit` 0 errors.
10. `npm run lint` 0 errors.

## Arquivos tocados

| Arquivo | Acao |
|---|---|
| `proxy.ts` | Investigar (possivelmente sem mudanca de codigo) |
| `middleware.ts` | NEW se fallback necessario — re-exporta `proxy` como `middleware` |
| `next.config.ts` | Auditar — `experimental` ou config relacionada a proxy |
| `src/lib/use-me-profile.ts` (path a confirmar) | Edit — AbortController + ignore AbortError |
| `docs/ADR-007-proxy-vs-middleware.md` | NEW — decisao registrada |

**Sem migration, sem novo schema.**

## Smoke Criteria (manuais)

### Auth gating (com prod build)
```bash
npm run build && npm run start &
sleep 5
curl -o /dev/null -w "GET /          : HTTP %{http_code} → %{redirect_url}\n" -L http://localhost:3000/
curl -o /dev/null -w "GET /desenrolos: HTTP %{http_code} → %{redirect_url}\n" http://localhost:3000/desenrolos
curl -o /dev/null -w "GET /me        : HTTP %{http_code} → %{redirect_url}\n" http://localhost:3000/me
curl -o /dev/null -w "GET /api/contacts (no cookie): HTTP %{http_code}\n" http://localhost:3000/api/contacts
curl -o /dev/null -w "GET /login: HTTP %{http_code}\n" http://localhost:3000/login
```

Esperado:
- `/` `/desenrolos` `/me` → 307 → /login
- `/api/contacts` → 401 (JSON)
- `/login` → 200

### Race fix
1. Login. Navegar imediatamente `/` → click sidebar contato → `/desenrolos/[id]` → click "Perfil" → `/me`. Total < 1s.
2. DevTools > Network: nenhum `/api/me/profile` com status 0 ou (canceled).
3. Console limpo (sem `AbortError` nao tratado).

## Guard-rails

- **NAO criar `middleware.ts` SEM confirmar bug do `proxy.ts`** em prod build. CLAUDE.md L26 diz explicito: "middleware.ts is deprecated; auth gating lives in proxy.ts". Fallback so se proxy realmente falhar em prod tambem.
- **NAO mexer no matcher do proxy** sem necessidade — exclusao de `/api` (linha 32) e' intencional pra `/api/*` devolver 401 JSON ao inves de 307 (CLAUDE.md L73-74 documenta).
- **AbortError NAO e' erro real** — catch deve filtrar: `if (err.name !== 'AbortError') ...`.
- **NAO usar `useSWR` ou `react-query`** pra "resolver" o useMeProfile — escopo limitado, evita dependencia nova.
- **Testar com browser real** (Chrome com DevTools aberto), nao so curl.

## Riscos

| Risco | Impacto | Mitigacao |
|---|---|---|
| `proxy.ts` ser bug do Next 16.2.0 sem fix proximo | Alto (deploy continua exposto) | Fallback `middleware.ts` + ADR registrando decisao |
| Criar `middleware.ts` quebra build (Next reclama de duplicate) | Medio | Remover `proxy.ts` se for esse o caso e atualizar CLAUDE.md L26 |
| AbortController causar bug em strict mode dobrando mounts | Baixo | React 18+ ja tolera; testar em dev (strict) |
| ADR atrapalhar smoke de outras waves | Nenhum | doc separado, nao toca codigo |

## Proxima acao (executar)

### Fase 1 — Investigacao proxy (30-60min)
1. `rm -rf .next && npm run dev` → re-curl `GET /` sem cookie. Se virar 307, era cache stale (escrever ADR curto, fim).
2. Se ainda 200: `npm run build && npm run start` → re-curl. Se prod redireciona, e bug so do dev/Turbopack (registrar, deixar aberto, monitorar).
3. Se prod tambem 200: bug confirmado. Criar `middleware.ts` com fallback.
4. Atualizar `proxy.ts` ou criar fallback + atualizar CLAUDE.md L26 se necessario.

### Fase 2 — Race fix (15-30min)
5. Localizar hook (`grep -r 'use.*Me.*Profile' src/`).
6. Adicionar AbortController + filtro de AbortError.
7. Smoke manual no browser.

### Fase 3 — Gates + commit
8. `npm run build` (verificar 29 rotas, sem regressao).
9. `npx tsc --noEmit && npm run lint`.
10. Commit `fix(flirtai): auth gating server-side + abort race in useMeProfile (W7.3)`.
11. Gerar `HANDOFF-W7.3.md` + atualizar `docs/ROADMAP.md`.
