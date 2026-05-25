---
alias: dev-log-w3-flirtai
type: dev-log
status: done
tags: [flirtai, wave/W3, dev-log, vision, multimodal, commands]
date_e_hora: 24-05-2026
priority: high
projeto: flirtai
documento: dev-log Wave W3 fechada
versao: 1.0
mci_versao: v7.7
---

# Wave W3 fechada — Multimodal + Comandos (24-05-2026)

Track A do roadmap concluída (W0→W1→W2→W3). 3 commits atômicos, build verde, Tesseract.js sai do bundle.

## O que entregou

### M6 — commands.ts (commit `f82f922`)

Tirou `commandSuggestions` (array hardcoded) e `parseCommand` (if-chain por prefixo) de dentro de `flirt-ai-shell.tsx` (~120 linhas). Virou `src/lib/flirt/commands.ts`:

- `CoachCommand` com `iconName: CommandIconName` (string, não JSX) + `modeOverride?` + `defaultPrompt?`
- `COMMAND_ICONS` map no shell traduz `iconName` → componente lucide-react
- `parseCoachCommand` consolida o if-chain em data-driven (modeOverride e defaultPrompt vivem no próprio command)
- Pronto pra novo comando virar 1 linha em `COACH_COMMANDS` sem editar o shell

### C6 — Vision multimodal (commits `f02efc3` schema + `9811f13` impl)

Removeu Tesseract.js client-side. Print de WhatsApp agora vai direto pra Anthropic como `image` block:

- Schema: migration `20260525010000_add_message_attachments` adiciona `Message.attachments JSONB?`
- Shape persistido: `[{ type: "image", mediaType, name, data: <base64> }]`, só no turno do user
- `src/lib/flirt/attachments.ts` — source of truth do shape (zod + types compartilhados client/server). Limites: 5MB/imagem, 4 imagens/turn, tipos PNG/JPEG/WEBP/GIF
- `/api/coach` aceita prompt vazio se houver imagem (refine). Monta `content[]` misto com ImageBlockParam[] + text na última user message
- Shell lê arquivo via `ArrayBuffer → btoa` em chunks de 32KB (evita stack overflow em base64), gera object URL pra preview real no pill, revoga URL no unmount/remove
- Bundle reduz ~15MB (Tesseract + wasm + langs por/eng)

### M4 — Auto-avatar via vision (mesmo commit C6)

Quando o contato ainda **não tem avatar** e o user anexa imagem(ns), uma call Haiku 4.5 com tool `set_contact_avatar` decide qual anexo (se algum) é uma foto de perfil dela:

- `src/lib/flirt/avatar-vision.ts` — tool schema + caller isolado
- Filtro explícito no prompt: print de WhatsApp/feed/stories NÃO conta; só foto isolada onde ela é o sujeito principal
- Conservadora: `confidence: low` é descartada (skip silencioso)
- `Contact.avatarUrl = data:image/png;base64,...` quando aceita
- Falha não bloqueia o turn (try/catch, retorna `null` → skip)

## Gates

| Gate | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npm run build` | ✅ 25 rotas, standalone |
| `npm run lint` (meus arquivos) | ✅ 0 erros |
| `npm run lint` (geral) | ⚠️ 1 erro em `desenrolos/page.tsx` (W5/M5 da sessão paralela — não meu escopo) |
| Tesseract removido | ✅ `npm uninstall tesseract.js`, `use-ocr.ts` deletado |

## Achados durante execução

- **Sessão paralela trabalhando em W5 no mesmo working tree.** Durante a wave, outra sessão (ou agent) adicionou W5/M8 (Settings expandido — `CoachTone` enum, `User.timezone/locale/coachTone/notificationPrefs`, migration `20260525011534_add_user_preferences`, novo `system-prompt.ts` com tone addenda, novo `/api/settings/route.ts`) e W5/M5 (search server-side em `contacts/route.ts` + `desenrolos/page.tsx`). Tudo isso permanece **uncommitted** — não puxei nada disso pros meus commits W3.
- **Hot conflict no `/api/coach/route.ts`.** A sessão paralela injetou 2 linhas W5 (select `coachTone: true` + `buildSystemPrompt(mode, user?.coachTone ?? null)`) na minha rota. Removi manualmente antes do commit C6 pra manter a fronteira W3/W5 limpa. As 2 linhas voltaram pro working tree depois (parallel session re-aplicou) — fica como débito da W5 quando ela commitar.
- **`--amend` pós-fato em commit local.** O commit C6 inicialmente entrou sem o `src/lib/flirt/avatar-vision.ts` (esquecido no `git add`). Como nada foi pushado, amend ficou OK (regra Meres: amend só com pedido se já pushado).
- **Postgres dev offline** durante a wave (Docker não no PATH). Migration foi escrita manualmente seguindo padrão W4 (timestamped dir + `migration.sql`) e validada via `npx prisma validate` + `prisma generate`. Apply real em DB pendente quando o Meres subir o container.

## Próximos passos (Track C entrando)

Track A (W0→W3) fechada. Próxima é Track C — **W5 (Settings & Search)** que já está parcialmente codada pela sessão paralela. Conferir antes de fechar:
- Migration `20260525011534_add_user_preferences` precisa ser aplicada no DB
- Settings UI provavelmente já tem as 4 seções (Conta/Coach/Notificações/API)
- Search server-side em `/api/contacts?q=` + cliente debounce 250ms
- Lint error em `desenrolos/page.tsx:66` precisa ser resolvido (setState dentro de useEffect)

Track B (W4 — Profile Watch Hardening) já fechada em 24-05.

## Smoke manual pendente (Meres)

Quando subir Postgres:
1. Aplicar migration `20260525010000_add_message_attachments` (e a W5 quando ela commitar)
2. Anexar print de WhatsApp em conversa nova → confirmar que coach responde lendo o print (não usa OCR)
3. Confirmar que `message.attachments` tem a base64 persistida (via `prisma studio`)
4. Anexar foto isolada da contato em contact sem avatar → confirmar que `Contact.avatarUrl` populou
5. Anexar foto em contact que JÁ tem avatar → confirmar que NÃO sobrescreve
