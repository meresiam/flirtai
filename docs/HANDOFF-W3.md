---
alias: HANDOFF-W3-flirtai
type: handoff
status: done
tags: [flirtai, wave/W3, handoff, multimodal, vision, commands, anthropic]
date_e_hora: 24-05-2026
priority: high
projeto: flirtai
documento: HANDOFF-W3
wave: W3 — Multimodal + Comandos
versao: 1.0
fechada_em: 24-05-2026
proxima_wave: W5 — Settings & Search expandidos (parcialmente em curso pela sessão paralela)
mci_versao: v7.7
---

# HANDOFF — Wave 3 (Multimodal + Comandos)

## Status

- Wave: W3 — Multimodal + Comandos
- Periodo: 24-05-2026 → 24-05-2026
- Branch: master
- Commits: `f82f922` (M6) · `f02efc3` (C6 schema) · `9811f13` (C6 impl + M4)
- Resultado: ENTREGUE

### Arquivos modificados (escopo W3)

| Arquivo | Tipo | Wave/Ticket |
|---|---|---|
| `src/lib/flirt/commands.ts` | NOVO — COACH_COMMANDS + parseCoachCommand | M6 |
| `src/components/flirt-ai-shell.tsx` | consome lib + refactor attachments p/ base64 + preview real | M6, C6 |
| `prisma/schema.prisma` | `Message.attachments Json?` | C6 |
| `prisma/migrations/20260525010000_add_message_attachments/migration.sql` | NOVO — ADD COLUMN JSONB | C6 |
| `docs/DATA-MODEL.md` | shape de attachments + migration history | C6 |
| `src/app/api/coach/route.ts` | aceita attachments + monta image blocks + persiste + chama avatar-vision | C6, M4 |
| `src/lib/flirt/attachments.ts` | NOVO — zod schema + base64 encoder + limites compartilhados | C6 |
| `src/lib/flirt/avatar-vision.ts` | NOVO — tool `set_contact_avatar` + caller Haiku 4.5 | M4 |
| `src/lib/use-ocr.ts` | DELETADO — Tesseract.js obsoleto | C6 |
| `package.json` + `package-lock.json` | `tesseract.js` removido | C6 |

---

## O que funciona (entregue + verificado)

- [x] **M6 — Commands lib** — `COACH_COMMANDS` em `src/lib/flirt/commands.ts` com 4 comandos (`/nova`, `/resposta`, `/perfil`, `/encontro`). `parseCoachCommand` consolida o if-chain por prefixo em data (modeOverride + defaultPrompt no próprio command). Shell consome via icon-name map. Adicionar novo comando = 1 entrada no array.
- [x] **C6 — Vision substitui Tesseract** — `/api/coach` aceita `attachments: [{type, mediaType, name, data}]` no body, refine permite prompt vazio se houver imagem. Monta `content[]` misto com `Anthropic.ImageBlockParam[] + text` no último user turn. Persiste base64 em `Message.attachments` no turno do user pra replay futuro.
- [x] **C6 — Shell base64 fast path** — `fileToBase64Attachment` lê file → ArrayBuffer → btoa em chunks de 32KB (evita stack overflow). Object URL gerado pra preview real no pill, revogado em remove/unmount. Status `encoding` é quase instantâneo (sem espera de OCR).
- [x] **C6 — Bundle cleanup** — `tesseract.js`, `src/lib/use-ocr.ts`, langs `por`+`eng` (~15MB wasm) saem do client. `accept="image/png,image/jpeg,image/webp,image/gif"` (PDF não mais suportado — sem OCR).
- [x] **M4 — Auto-avatar** — `extractContactAvatar` (`src/lib/flirt/avatar-vision.ts`) chama Haiku 4.5 com tool `set_contact_avatar` quando `!contact.avatarUrl && attachments.length`. Decisão `low confidence` é descartada. `Contact.avatarUrl` recebe `data:image/...;base64,...`. Falha é silenciosa (try/catch → null).
- [x] **Migration C6** — `20260525010000_add_message_attachments` — `ALTER TABLE message ADD COLUMN attachments JSONB`. Baixo risco (nullable, sem backfill).
- [x] **Gates build** — `npx tsc --noEmit` exit 0 + `npm run build` 25 rotas standalone OK + lint dos arquivos W3 zero erros.

---

## O que NAO funciona / Bloqueadores

- [ ] **Smoke E2E real não rodado** — Postgres dev offline durante a wave (Docker não no PATH do shell). Build/typecheck/lint passaram, mas nenhum print foi anexado em runtime contra Anthropic real. Owner: Meres. Impacto: medium (código revisado + 0 erros estáticos, mas vision não foi exercitada end-to-end).
- [ ] **W5/M5 lint error em `src/app/desenrolos/page.tsx:66`** — `setState` dentro de useEffect (`react-hooks/set-state-in-effect`). NÃO é meu — vem da sessão paralela trabalhando em W5/M5 (search server-side). Build não quebra por isso (lint não é gate de build), mas é débito formal pra W5 fechar.
- [ ] **W5 contamination uncommitted no working tree** — sessão paralela adicionou: `CoachTone` enum + 4 campos `User` (timezone/locale/coachTone/notificationPrefs), migration `20260525011534_add_user_preferences`, `system-prompt.ts` com tone addenda, `/api/settings/route.ts` consumindo isso, `contacts/route.ts` com search server-side, `desenrolos/page.tsx` com debounce client. Também re-injetou 2 linhas W5 no meu `coach/route.ts` (select `coachTone: true` + 2º arg em `buildSystemPrompt`). Esses 2 deltas ficam como débito W5 — não puxei pros meus commits W3.

---

## Smoke E2E (critérios testáveis pelo smoke-runner / Meres manual)

- [ ] **C1 — Print com texto orienta o coach.** Anexar print de WhatsApp em conversa nova, prompt vazio → coach responde lendo o print (mensagens dela, contexto). Tempo end-to-end < 5s (antes era 5-15s com Tesseract). Validar: response faz referência a algo do print (não inventa contexto genérico).
- [ ] **C2 — Persistência do attachment.** Após o turn acima, abrir `prisma studio` → tabela `message` → última row do user → coluna `attachments` deve ter array `[{type, mediaType, name, data}]` com base64 não-vazio. Tamanho aproximado: 1.3x do tamanho do arquivo original.
- [ ] **C3 — Limite de tipo.** Tentar anexar `.pdf` no input file → o `accept` do input filtra (não aparece no picker). Se forçado via drag-and-drop (não suportado hoje), o lado server faz zod parse falhar com 400.
- [ ] **C4 — Limite de tamanho.** Anexar imagem > 5MB → shell mostra status `error` com mensagem PT-BR ("Imagem muito grande (X.XMB). Máximo: 5MB."). Server faz duplo-check via zod (`MAX_BASE64_LENGTH`).
- [ ] **C5 — Multi-attach.** Anexar 4 imagens → todos viram pill com preview. Tentar anexar 5ª → server retorna 400 (zod `.max(MAX_ATTACHMENTS_PER_TURN)`).
- [ ] **C6 — Imagem-only (sem texto).** Anexar 1 imagem, prompt vazio, send → request vai com `prompt: ""` + 1 attachment. Refine no zod permite. Coach responde lendo o print. Mensagem persistida com `content: "[1 imagem(ns) anexada(s)]"`.
- [ ] **M4-1 — Auto-avatar populando.** Criar contact sem avatar, anexar foto isolada dela (não print) + prompt textual → após response, `Contact.avatarUrl` deve ter `data:image/...;base64,...` e UI sidebar mostra avatar. Pode demorar +2-4s (call Haiku adicional).
- [ ] **M4-2 — Auto-avatar respeita avatar existente.** Criar contact COM avatar manual, anexar foto isolada → após response, `Contact.avatarUrl` NÃO muda. Cond na rota: `if (!contact.avatarUrl && attachments.length)`.
- [ ] **M4-3 — Auto-avatar rejeita print.** Anexar print de WhatsApp (não foto isolada) em contact sem avatar → após response, `Contact.avatarUrl` continua null. Prompt do tool inclui regra explícita "print não conta".
- [ ] **M6-1 — Comando vira lib.** Em `/desenrolos/[id]`, digitar `/perfil ela me bloqueou` → command palette mostra "Extrair perfil" highlighted. Tab/Enter → injeta `/perfil ` no input. Send → coach roda em `mode: "strategy"` (verificável em Langfuse).
- [ ] **M6-2 — Novo comando = 1 linha.** Adicionar `{ prefix: "/foo", label: "Foo", description: "...", iconName: "sparkles" }` em `COACH_COMMANDS` → palette mostra Foo automaticamente. Não precisa editar o shell.

---

## Done Criteria (do plano-mãe — ROADMAP.md W3)

- [x] **C6 — Eliminar Tesseract.** `src/lib/use-ocr.ts` deletado; `tesseract.js` removido do `package.json`/lockfile; bundle do client não tem mais wasm.
- [x] **C6 — Aceitar imagem no `/api/coach` + repassar como image block.** Implementado via JSON body com `attachments[]` (base64). Image block Anthropic montado dinamicamente.
- [x] **C6 — `Message.attachments Json?`.** Schema + migration prontos. Persistido no turno do user no transaction.
- [x] **M6 — `src/lib/flirt/commands.ts` exporta `COACH_COMMANDS: Command[]`.** Pronto + consumido pelo shell.
- [x] **M4 — Quando print contém foto de perfil dela detectável, extrair via Vision e setar `Contact.avatarUrl`.** Implementado (skip se já tem). Inline base64 (decisão MVP — `Cloudflare R2` adiado).
- [ ] **Gate: print de WhatsApp processa < 3s end-to-end.** Pendente smoke real. Latência estimada: 1.5-3.5s (sem Tesseract + 1 round-trip Anthropic). M4 adiciona +2-4s quando dispara (call Haiku extra) — fica acima do gate de 3s nesse caso.
- [x] **Gate: 1 comando de exemplo extrai foto e seta avatar.** Logica implementada (qualquer turn com imagem dispara M4 se contact sem avatar — não precisa de comando explícito).
- [x] **Gate: bundle do client reduz.** Tesseract.js + wasm + langs por/eng saem (~15MB reduzidos no client).

---

## Guard-rails (avisos críticos pra próxima sessão)

- **NUNCA reverter para Tesseract.** `src/lib/use-ocr.ts` foi deletado e `tesseract.js` saiu do `package.json`. Se um turn precisar de OCR puro (texto sem multimodal), use o image block do Anthropic e peça transcrição no prompt — sem voltar pro worker client-side.
- **Não inflar `MAX_ATTACHMENT_BYTES` sem revalidar.** Limite atual: 5MB/imagem, 4 imagens/turn. Anthropic suporta até 5MB por imagem (limite oficial); subir além vai falhar no provider. Se Meres pedir "manda imagem maior", refactorar pra storage externo (R2) primeiro.
- **`Message.attachments` é write-once.** Não há endpoint pra editar attachments depois que a message foi persistida. Se precisar (delete por LGPD/limpeza), criar endpoint dedicado + auditoria.
- **`extractContactAvatar` falha silenciosa.** Erro de rede / parsing / confidence-low → retorna `null`. Não bloqueia o turn principal. Não adicionar throw ali sem revisar — quebrar o coach por causa de avatar é UX ruim.
- **Avatar `data:` URL inflada.** Cada `Contact.avatarUrl` pode ter 50-300KB de base64 inline. Em queries que retornam muitos contacts, **NÃO** SELECT `avatarUrl` se não for usar — está em `src/app/api/contacts/route.ts` (todos os contacts vêm com avatarUrl). Quando o volume crescer, migrar pra R2.
- **W5 deltas no working tree** — `coach/route.ts` tem 2 linhas W5 (select `coachTone` + 2º arg em `buildSystemPrompt`) que vão entrar quando a W5 commitar. Não revertê-las se aparecerem em `git status`.

---

## Próximas ações

1. **Smoke manual (Meres)** — subir Postgres (`docker compose up -d`) + aplicar migrations W3+W5 (`npx prisma migrate deploy` ou `npx prisma migrate dev`) + rodar os 12 critérios de smoke acima.
2. **Fechar W5** — a sessão paralela já adiantou Settings expandido (M8) + Search server-side (M5). Conferir migration `20260525011534_add_user_preferences`, rodar lint até zerar (resolver `setState` em useEffect de `desenrolos/page.tsx`), abrir HANDOFF-W5.md.
3. **W6 (Memória do Homem)** — depende de W5 fechada. Bloco grande (4-6 dias). Antes de iniciar, atualizar `docs/DATA-MODEL.md` com `UserProfile` e `docs/COMPONENT-MAP.md` com rotas `/me` + onboarding.
4. **Validar latência W3.** Comparar TTFB no Langfuse antes/depois — antes (W2) ≤500ms; agora com vision + M4 ativo, esperar 2-4s mais alto. Documentar em ROADMAP se exceder gate de 3s.

---

## Achados durante execução (drifts, surpresas)

- **Sessão paralela em W5 no mesmo working tree.** Detectada via `git status` mostrando arquivos modificados que eu não tinha tocado (`prisma/schema.prisma` com CoachTone, `system-prompt.ts` com tone addenda, `settings/route.ts`, `contacts/route.ts`, `desenrolos/page.tsx`). Estratégia adotada: NÃO commitar nada dela, manter W3 isolado, deixar a W5 fechar separado. Risco: working tree fica num estado misto durante a transição — qualquer outro agent que rodar `git add .` aqui vai bagunçar.
- **`/api/coach/route.ts` recebeu injeção W5 in-flight.** Adicionei meu C6+M4 puro, stagei, e a sessão paralela re-aplicou 2 linhas W5 depois do stage. Pruney manualmente antes do commit. Padrão se repetir: rodar `git diff --cached` antes de cada `git commit` pra confirmar.
- **`--amend` em commit local foi usado.** O commit C6 inicialmente saiu sem `src/lib/flirt/avatar-vision.ts` (import quebrado, mas build no working tree não notou porque o arquivo estava lá). Amend OK porque o commit nunca foi pushado (regra Meres: amend só com pedido se pushed).
- **Postgres dev offline.** Migration foi escrita à mão seguindo padrão W4 (timestamped dir + `migration.sql`), validada via `prisma generate` + `prisma validate`. Apply real pendente pro Meres subir Postgres.
- **Decisão de storage MVP confirmada com Meres no início da wave**: base64 inline em DB + LLM, sem R2/volume Coolify. Trocar pra URL futura é Json compatível (mesmo campo, shape extensível).
- **Padrão de commit "atômico por item" cumprido.** 3 commits M6/C6-schema/C6-impl(+M4). Cada um buildable independente (depois do amend que bundlou avatar-vision.ts no C6-impl).
