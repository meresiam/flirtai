---
alias: ADR-007-proxy-location-flirtai
type: adr
status: accepted
projeto: flirtai
documento: ADR-007
adr_numero: 007
titulo: proxy.ts deve viver em src/, nao na raiz do repo
data: 25-05-2026
decisor: Meres + Claude (sessao W7.3)
mci_versao: v7.7
tags: [flirtai, adr, next-16, auth, proxy, middleware]
---

# ADR-007 — proxy.ts deve viver em `src/proxy.ts`, nao na raiz do repo

## Status

Aceito — aplicado em 25-05-2026 dentro da W7.3.

## Contexto

O SMOKE-W7-DONE (25-05-2026) reportou Bug #2 (medio/critico em prod):

```bash
$ curl -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/
HTTP 200          # deveria 307 → /login
$ curl -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/desenrolos
HTTP 200          # idem
$ curl -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/me
HTTP 200          # idem
```

Auth gating server-side estava INATIVO. Crawlers, bots e scrapers recebiam HTML completo de qualquer rota sem cookie. Auth so funcionava client-side via o redirect que o store Zustand fazia quando `/api/contacts` devolvia 401.

`CLAUDE.md` L26 documentava:

> middleware.ts is deprecated; auth gating lives in `proxy.ts` at the repo root.

E o `proxy.ts` estava de fato na raiz com shape correta de Next 16:

```ts
// proxy.ts (raiz)
export async function proxy(request: NextRequest) { ... }
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
```

## Investigacao (W7.3, 25-05-2026)

### Passo 1 — Build limpo

```bash
$ rm -rf .next && npm run build
✓ Compiled successfully in 2.3s
✓ Generating static pages using 17 workers (18/18) in 163ms
```

O build NAO listava linha `ƒ Proxy (Middleware)` no route table. Inspecao do manifest confirmou:

```bash
$ cat .next/server/middleware-manifest.json
{"version": 3, "middleware": {}, "sortedMiddleware": [], "functions": {}}
```

**Manifest vazio.** O Next nao registrou nenhum middleware/proxy. Logo, nao tinha como executar.

### Passo 2 — Mover o arquivo

Releitura cuidadosa da doc oficial em `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` linha 23:

> Create a `proxy.ts` (or `.js`) file in the project root, or inside `src` if applicable, **so that it is located at the same level as `pages` or `app`**.

Nossa estrutura: `src/app/`. Logo `proxy.ts` deve estar em `src/proxy.ts`, NAO na raiz do repo.

```bash
$ mv proxy.ts src/proxy.ts
$ rm -rf .next && npm run build | tail -3
ƒ Proxy (Middleware)
```

Linha `ƒ Proxy (Middleware)` agora aparece. Proxy compilado.

### Passo 3 — Validacao curl

```bash
$ npm run start &
$ sleep 5
$ curl -s -o /dev/null -w "GET /            : HTTP %{http_code} → %{redirect_url}\n" http://localhost:3010/
GET /            : HTTP 307 → http://localhost:3010/login
$ curl -s -o /dev/null -w "GET /desenrolos  : HTTP %{http_code} → %{redirect_url}\n" http://localhost:3010/desenrolos
GET /desenrolos  : HTTP 307 → http://localhost:3010/login?redirect=%2Fdesenrolos
$ curl -s -o /dev/null -w "GET /me          : HTTP %{http_code} → %{redirect_url}\n" http://localhost:3010/me
GET /me          : HTTP 307 → http://localhost:3010/login?redirect=%2Fme
$ curl -s -o /dev/null -w "GET /api/contacts: HTTP %{http_code}\n" http://localhost:3010/api/contacts
GET /api/contacts: HTTP 401
$ curl -s -o /dev/null -w "GET /login       : HTTP %{http_code}\n" http://localhost:3010/login
GET /login       : HTTP 200
```

**Tudo conforme esperado.** Inclui o `?redirect=` preservando a rota original (logica `loginUrl.searchParams.set("redirect", pathname)` agora ativada).

### Passo 4 — Validacao standalone

Mesma sequencia com o bundle standalone que o Docker copia em prod:

```bash
$ cd .next/standalone && PORT=3010 node server.js &
$ curl -s -o /dev/null -w "STANDALONE GET /: HTTP %{http_code} → %{redirect_url}\n" http://localhost:3010/
STANDALONE GET /: HTTP 307 → http://localhost:3010/login
$ curl -s -o /dev/null -w "STANDALONE GET /desenrolos: HTTP %{http_code} → %{redirect_url}\n" http://localhost:3010/desenrolos
STANDALONE GET /desenrolos: HTTP 307 → http://localhost:3010/login?redirect=%2Fdesenrolos
$ curl -s -o /dev/null -w "STANDALONE GET /me: HTTP %{http_code} → %{redirect_url}\n" http://localhost:3010/me
STANDALONE GET /me: HTTP 307 → http://localhost:3010/login?redirect=%2Fme
$ curl -s -o /dev/null -w "STANDALONE GET /api/contacts: HTTP %{http_code}\n" http://localhost:3010/api/contacts
STANDALONE GET /api/contacts: HTTP 401
$ curl -s -o /dev/null -w "STANDALONE GET /login: HTTP %{http_code}\n" http://localhost:3010/login
STANDALONE GET /login: HTTP 200
```

Standalone tambem ok. Path certo pra Docker.

## Decisao

1. **`proxy.ts` vive em `src/proxy.ts`**, no mesmo nivel do `src/app/`.
2. **NAO** criar fallback `middleware.ts` — a feature `proxy.ts` funciona quando o path certo e usado.
3. **NAO** abrir issue no Next 16.2.0 — comportamento documentado, foi misconfiguration do projeto.
4. **CLAUDE.md** atualizado (L26) refletindo a localizacao correta.

## Consequencias

### Positivas

- Auth gating server-side **ativo** em dev (turbopack) e prod (standalone). Crawlers/bots veem 307 → /login em rotas privadas.
- `loginUrl.searchParams.set("redirect", pathname)` finalmente funciona — pos-login leva o usuario de volta pra rota tentada.
- Excluido `/api/*` do matcher continua devolvendo 401 JSON limpo (nao 307), preservando o contrato pro client.
- Sem necessidade de manter `middleware.ts` deprecated — alinhado com a direcao oficial do Next 16.

### Negativas / Pendencias

- **Dev-log do W0** ([dev-log/24-05-2026 - Wave W0 fechada (partial).md](dev-log/24-05-2026%20-%20Wave%20W0%20fechada%20(partial).md)) e outras docs internas que mencionam `proxy.ts` na raiz precisam de revisao. So o CLAUDE.md foi atualizado nesta sessao.
- Smokes anteriores (W0..W7) rodaram com auth gating CLIENT-SIDE ONLY. Re-rodar smokes criticas com auth gating server-side ativo.
- Docker (Dockerfile) **nao precisa** de mudanca — Next compila `src/proxy.ts` em `.next/server/middleware.js`, que o standalone server ja carrega.

## Alternativas consideradas (rejeitadas)

| Alternativa | Por que rejeitada |
|---|---|
| Criar `middleware.ts` na raiz como fallback | Quebra com CLAUDE.md L26 deprecation. Adiciona codigo morto quando proxy.ts ja funciona no path certo. |
| Manter `proxy.ts` na raiz + flag custom em next.config.ts | Nao existe flag pra isso na Next 16.2.0. Doc oficial e explicita sobre a localizacao. |
| Abrir issue no Next | Comportamento documentado. Issue seria fechado como user error. |
| Esperar fix upstream | Nao ha bug upstream pra ser fixado. |

## Referencias

- SMOKE-W7-DONE Bug #2: `docs/SMOKE-W7-DONE.md` linhas 98-116
- Spec W7.3: `docs/WAVE-W7.3.md`
- Doc oficial Next 16: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` linha 23
- Doc migration middleware→proxy: mesma fonte, linha 733
- CLAUDE.md atualizado: linha 26

## Aprendizado

Ler a doc **inteira** antes de assumir que arquivo na raiz funciona. A regra "mesmo nivel de `app/` ou `pages/`" e contraintuitiva pra quem ta acostumado com `next.config.ts` ou `tsconfig.json` ficarem sempre na raiz, mas e' explicita na doc oficial. Em projetos com `src/`, todos os file-conventions roteaveis (`middleware`, `proxy`, futuros) seguem `src/<nome>.ts`.
