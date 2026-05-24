# Squad FlirtAI — Agentes Especialistas

Squad de 8 subagentes especializados por **superfície de mudança** do flirtai. Cada agente tem raio de ação estreito + lista de arquivos canônicos pra ler antes de propor diff. Quem coordena (Claude principal) chama o agente certo via `Agent({ subagent_type: "<nome>" })`.

## Como o roteamento funciona

Cada agente tem `description` action-oriented com triggers PT-BR. Claude Code escolhe o agente automaticamente quando o pedido bate com triggers + descrição. Você também pode chamar manualmente: "usa o coach-llm-agent pra mudar o system prompt".

## Mapa de raio de ação

| Agente | Domínio | Arquivos-chave |
|---|---|---|
| `desenrolo-shell-agent` | UI do chat wingman | `flirt-ai-shell.tsx`, `use-flirt-store.ts`, `desenrolo-form.tsx`, `use-ocr.ts` |
| `coach-llm-agent` | Cérebro Anthropic | `api/coach/route.ts`, `lib/flirt/coach-schema.ts`, `lib/flirt/system-prompt.ts` |
| `contacts-agent` | CRUD Contact/Message/Analysis | `api/contacts/*`, model Contact, `serializers.ts` |
| `profile-watch-agent` | UI + REST do Profile Watch | `app/profiles/**`, `components/profile-watch/*`, `api/profiles/*` |
| `scraper-integrations-agent` | Apify + Meta Graph + diff | `lib/profile-watch/{apify,meta-graph,post-differ,token-crypto}*` |
| `cron-retention-agent` | Cron, report IA, purga LGPD | `api/cron/*`, `cron-runner.ts`, `report-builder.ts`, `purge.ts` |
| `auth-settings-agent` | better-auth + settings | `lib/auth*.ts`, `proxy.ts`, `api/auth/[...all]`, `api/settings` |
| `platform-agent` | Schema, build, deploy, rate-limit | `prisma/schema.prisma`, `Dockerfile`, `next.config.ts`, `lib/db.ts`, `lib/rate-limit.ts` |

## Regras de fronteira (anti-sobreposição)

- **Mudança no schema da tool LLM** → `coach-llm-agent` muda contrato → `desenrolo-shell-agent` consome.
- **Novo campo no Contact** → `platform-agent` (migration) → `contacts-agent` (boundary/zod) → `coach-llm-agent` (se LLM popula).
- **Nova métrica de Profile** → `scraper-integrations-agent` (capturar) → `platform-agent` (migration) → `profile-watch-agent` (exibir).
- **Mudança em proxy.ts ou cookie de auth** → `auth-settings-agent` é o único.
- **Cron ou retenção** → `cron-retention-agent` chama `scraper-integrations-agent`, nunca o inverso.

## Padrão dos agentes (boas práticas Anthropic)

- `name`: kebab-case
- `description`: action-oriented em PT-BR com triggers explícitos (Claude usa pra rotear)
- `tools`: restritos ao mínimo (Read/Glob/Grep + Edit/Write/Bash)
- `model: inherit` — herda o modelo da sessão (Opus/Sonnet)
- System prompt focado: identidade, arquivos canônicos, regras invariantes, fronteiras, como entregar

## Manutenção

Quando uma feature nova nasce que não cabe nos 8, ou um agente fica gordo demais:
1. Splittar agente existente OU criar novo.
2. Atualizar este README + tabela de fronteira.
3. Atualizar `MEMORY.md` no auto-memory (entrada do flirtai).
