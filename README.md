# Flirt.ai

Wingman pessoal para conversas de relacionamento. Você cola a mensagem dela ou descreve o contexto; o coach lê a situação, sugere 3 a 5 respostas em tons diferentes (Provocativa, Confiante, Intrigante, Direta), atualiza o perfil dela na lateral e mantém histórico por contato.

## Stack

- **Next.js 16** (App Router, Turbopack, React 19)
- **Prisma 7** + **Postgres 16** (driver adapter `@prisma/adapter-pg`)
- **better-auth** (email + senha)
- **Anthropic SDK** + **Claude Sonnet 4.6** (com tool_use para structured output)
- **Zustand** (cache client) + **Tailwind v4** + **shadcn**
- Deploy: **Coolify** (Docker)

## Pré-requisitos

- Node 22+
- Docker (Postgres local) ou Postgres rodando em outro lugar
- Conta na [Anthropic Console](https://console.anthropic.com) com crédito + uma API key

## Rodar local

```bash
# 1. Clonar e instalar
git clone https://github.com/meresiam/flirtai.git
cd flirtai
npm install

# 2. Configurar .env (copia o exemplo e preenche)
cp .env.example .env
# Gere um secret para better-auth:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Cole no BETTER_AUTH_SECRET. Adicione sua ANTHROPIC_API_KEY.

# 3. Subir Postgres
docker compose up -d

# 4. Migration inicial
npx prisma migrate dev --name init

# 5. Dev server
npm run dev
```

Abra http://localhost:3000 → será redirecionado para `/signup` na primeira vez.

## Comandos do chat

- `/nova [nome]` — cria nova conversa (contato)
- `/resposta` — pede a melhor resposta para a última mensagem dela
- `/perfil` — atualiza o perfil dela com base no contexto
- `/encontro` — estratégia para puxar a conversa para um encontro

Sem comando: o coach interpreta o input como nova mensagem da conversa atual.

## Variáveis de ambiente

| ENV                    | Obrigatória | Default               | Descrição                                  |
|------------------------|-------------|-----------------------|--------------------------------------------|
| `DATABASE_URL`         | sim         |                       | Postgres connection string                 |
| `ANTHROPIC_API_KEY`    | sim         |                       | Key da Anthropic                           |
| `ANTHROPIC_MODEL`      | não         | `claude-sonnet-4-6`   | ID do modelo Claude                        |
| `BETTER_AUTH_SECRET`   | sim         |                       | 32+ bytes random hex                       |
| `BETTER_AUTH_URL`      | sim         | `http://localhost:3000` | URL base pública                         |
| `RATE_LIMIT_PER_HOUR`  | não         | `60`                  | Chamadas a `/api/coach` por user por hora  |

## Deploy (Coolify)

1. Push para `main` no GitHub.
2. No Coolify, criar **Application** apontando para o repo.
3. Build type: **Dockerfile**.
4. Adicionar **Postgres** service no mesmo Project (1-click).
5. Setar as ENVs acima.
6. Configurar domínio (Cloudflare DNS).
7. Deploy. O start command roda `prisma migrate deploy` antes do `next start`.

## Estrutura

```
app/
├── api/
│   ├── auth/[...all]/      better-auth handler
│   ├── coach/              Anthropic Claude + persiste mensagens
│   └── contacts/           CRUD de contatos
├── login/                  email + senha
├── signup/                 cadastro
└── page.tsx                shell do chat

components/
├── flirt-ai-shell.tsx      UI principal (chat + sidebar + comandos)
└── contact-avatar.tsx      avatar com fallback inicial-gradiente

lib/
├── auth.ts                 better-auth config
├── auth-client.ts          hooks React
├── api-auth.ts             helper requireUser()
├── db.ts                   Prisma client singleton
├── rate-limit.ts           60/h por user
├── serializers.ts          DB → JSON (snake_case → camelCase)
└── flirt/
    ├── coach-schema.ts     tool_use JSON schema
    └── system-prompt.ts    prompts por mode

prisma/
└── schema.prisma           5 tabelas + 3 tabelas auth

docs/
├── DATA-MODEL.md
├── COMPONENT-MAP.md
└── v2-roadmap/             ideias para futuro

proxy.ts                    redireciona não-logado para /login
docker-compose.yml          Postgres local
```

## Stack notes

- **Next 16:** `middleware.ts` deprecated → use `proxy.ts`. Build com Turbopack.
- **Prisma 7:** datasource URL vai em `prisma.config.ts`, não no schema. Engine usa driver adapter `@prisma/adapter-pg` em vez do engine binário.
- **Anthropic tool_use:** equivalente ao JSON Schema strict da OpenAI. O modelo é forçado a chamar `submit_flirt_response` com o input estruturado.
