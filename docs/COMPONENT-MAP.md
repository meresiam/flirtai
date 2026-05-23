# FlirtAI — COMPONENT-MAP

> Component-First. Mapa dos blocos da UI, estado local vs global, e onde cada coisa vive.

## Hierarquia (Atoms → Pages)

```
app/layout.tsx                          ← fonts + theme + global CSS
├── app/page.tsx                        ← Home (shell do chat)
│   └── components/flirt-ai-shell.tsx   ← <FlirtAiShell />  [client]
│       ├── <ConversationSidebar/>      ← lista de contatos + busca + nova conversa
│       │   └── <ContactCard/>          ← item da lista
│       ├── <ChatHeader/>               ← avatar + name + status + tags do contato ativo
│       ├── <ChatMessages/>             ← lista de mensagens (user/assistant)
│       │   ├── <UserBubble/>
│       │   └── <AssistantBubble/>
│       │       ├── <InsightChips/>     ← Interesse/Leitura/Mover/Evitar
│       │       └── <SuggestionCard/>   ← 4 tons, click → preenche input
│       ├── <EmptyState/>               ← 3 prompts pré-prontos
│       ├── <ChatInput/>                ← textarea + attach + command palette + send
│       │   ├── <CommandPalette/>       ← /nova /resposta /perfil /encontro
│       │   ├── <AttachmentChips/>      ← imagens em OCR processing
│       │   └── <TypingDots/>           ← indicador "Pensando"
│       └── <MobileDrawer/>             ← sidebar como overlay em <lg
│
├── app/login/page.tsx                  ← email + senha
├── app/signup/page.tsx                 ← email + senha + nome
│
├── app/api/auth/[...all]/route.ts      ← better-auth handler
├── app/api/coach/route.ts              ← Anthropic Claude → JSON estruturado
├── app/api/contacts/route.ts           ← GET (lista) · POST (cria)
├── app/api/contacts/[id]/route.ts      ← GET · PATCH · DELETE
└── app/api/messages/route.ts           ← GET por contactId · POST
```

> A UI atual tem TUDO inline em `flirt-ai-shell.tsx` (~1285 linhas). Não vamos quebrar em arquivos separados nessa entrega — refator visual seria retrabalho. Os subcomponents acima são lógicos, dentro do mesmo arquivo.

## Estado

### Local (useState dentro do shell)
- `value` — texto do input
- `attachments` — `Array<{ name, ocrText?, status }>` (W3)
- `isTyping` — request em voo
- `showCommandPalette` — palette aberta
- `activeSuggestion` — index navegação ↑↓
- `searchValue` — busca na sidebar
- `sidebarOpen` — drawer mobile
- `errorMessage` — erro da última call

### Global (Zustand — `store/use-flirt-store.ts`)
- `contacts: ContactRecord[]` — espelho do DB no client
- `selectedContactId: string`
- `hasHydrated: boolean` — flag de bootstrap (server-loaded)
- Actions: `selectContact`, `createContact`, `appendMessage`, `applyCoachResponse`, `setHasHydrated`
- Persist: localStorage v4 (versão sobe no W0.6 pra invalidar cache antigo sem userId)

### Server (sessão)
- `auth()` — `better-auth` retorna `{ user, session }` ou `null`
- `middleware.ts` redireciona `/` → `/login` se sem sessão

## Fluxos críticos

### 1. Login
```
/login → email + senha → POST /api/auth/sign-in/email
       → set cookie HttpOnly → redirect /
```

### 2. Bootstrap do shell
```
<FlirtAiShell/> mount
  → useEffect: fetch /api/contacts
  → set contacts no Zustand
  → setHasHydrated(true)
  → renderiza lista
```

### 3. Enviar mensagem
```
input → handleSendMessage()
  → parseCommand() detecta /nova /resposta /perfil /encontro
  → appendMessage local (optimistic)
  → POST /api/coach { contact, prompt, mode, history.slice(-8) }
  → coach route: rate limit check → Anthropic call → persiste Message → retorna JSON
  → applyCoachResponse(): atualiza contact + adiciona assistant bubble
  → scroll to bottom
```

### 4. OCR de imagem (W3)
```
attach image → useOcr(file) [tesseract.js worker]
  → status "lendo" no chip
  → texto extraído aparece como preview editável acima do input
  → user revisa → handleSendMessage envia o texto
```

## Naming Lock no front

| Tipo               | Convenção         |
|--------------------|-------------------|
| Componente         | PascalCase        |
| Hook               | camelCase `use*`  |
| Arquivo .tsx       | kebab-case        |
| Prop / state       | camelCase         |
| Tailwind class     | kebab-case        |

## Mobile-first (régua antes de fechar)

- Sidebar = drawer overlay no mobile (`lg:hidden`). ✅
- Touch targets ≥ 44px (botões circulares 40px na sidebar — ⚠️ verificar W4).
- Empty state cards quebram em coluna no mobile. ✅
- Command palette ocupa quase a largura inteira do input no mobile. ✅
- Input textarea autoresize com max 220px. ✅

## Nielsen — checklist H1-H10 a aplicar antes de fechar entrega (W4)

| # | Status atual | Pendente                                                 |
|---|--------------|----------------------------------------------------------|
| H1 | ✅ Loading + typing dots + toast erro      |                                                 |
| H2 | ✅ Copy em PT-BR direto                     |                                                 |
| H3 | ⚠️ Sem cancelar geração                     | "Parar" durante coach streaming (W3 opcional)    |
| H4 | ✅ shadcn + cor accent consistente          |                                                 |
| H5 | ⚠️ Sem confirmação ao deletar conversa      | Modal confirm ao deletar (W2 opcional)           |
| H6 | ✅ Comandos visíveis no rodapé              |                                                 |
| H7 | ✅ Atalhos: Enter envia, Shift+Enter quebra |                                                 |
| H8 | ✅ 1 CTA primário (Enviar)                  |                                                 |
| H9 | ⚠️ Erro 429/500 genérico                    | Mensagens específicas (rate limit, model 404)   |
| H10| ⚠️ Sem `/help` no agente                    | Comando `/help` lista atalhos (W3 opcional)      |

Critério de fechamento: zero BLOCK, ≤2 FLAGs justificadas. H3/H5/H10 ficam FLAG.
