---
reviewed: 2026-05-24T22:45:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/lib/flirt/commands.ts
  - src/lib/flirt/attachments.ts
  - src/lib/flirt/avatar-vision.ts
  - src/app/api/coach/route.ts
  - src/components/flirt-ai-shell.tsx
  - prisma/schema.prisma
  - prisma/migrations/20260525010000_add_message_attachments/migration.sql
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
---

# Code Review Report

**Reviewed:** 2026-05-24T22:45:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Wave W3 introduz dois movimentos principais: extração da lib de comandos do shell pra `src/lib/flirt/commands.ts` (M6) e troca do pipeline OCR client-side por vision multimodal nativa Anthropic (C6), incluindo um novo lib `avatar-vision.ts` que tenta auto-detectar avatar do contato. O code quality é alto — naming lock respeitado em todo o caminho DB→Anthropic, schema Zod sólido, abort de upload tratado, error handling no SSE coerente com o pattern já existente em W2.

Achei 1 issue crítico que é o vetor real de DoS/OOM (4 imagens × 5MB base64 = ~28MB JSON por request, sem cap global de body e sem AbortSignal forwarding nas chamadas internas Anthropic), e 6 warnings principalmente em torno de: memory leak de `URL.createObjectURL` no unmount, falta de gate UI sobre `MAX_ATTACHMENTS_PER_TURN` no upload (só falha no POST), latência sequencial do avatar-vision no critical path do turn, e o `applyCoachResponse` perdendo anexos do user em caso de erro mid-stream. As escolhas MVP confirmadas com o Meres (base64 inline, swallow-error em avatar detection) estão respeitadas e não foram flagadas.

## Critical Issues

### CR-01: Body cap ausente — request POST /api/coach aceita ~28MB de JSON

**File:** `src/app/api/coach/route.ts:35-48` + `src/lib/flirt/attachments.ts:12-21`
**Issue:** O schema permite até `MAX_ATTACHMENTS_PER_TURN` (4) × `MAX_BASE64_LENGTH` (~6.99MB cada, derivado de `MAX_ATTACHMENT_BYTES = 5MB` com overhead base64) = **~28MB de string base64 no body** por request, antes mesmo do Zod parse. Combinado com o rate limit de 60/h por user, um usuário malicioso (ou um cliente buggy com retry agressivo) consegue submeter ~1.7GB/h de payload, e cada request reside em memória do server enquanto o `await request.json()` parseia + Zod copia + o Anthropic SDK copia de novo pra montar `ImageBlockParam`. Em Coolify com workers Node de ~512MB, 2-3 requests concurrentes desse tamanho podem OOM-killar o container. Não tem proteção em `next.config.ts` (sem `serverActions.bodySizeLimit`, sem Route Segment Config `export const maxDuration`/`bodyLimit`).

**Fix:** Adicionar guard de body size ANTES do `request.json()` usando `Content-Length` header + curto-circuito explícito:

```ts
// no topo da rota, antes de await request.json()
const MAX_REQUEST_BYTES = 30 * 1024 * 1024; // 30MB hard cap (4 attachments × ~7MB base64 + overhead)
const contentLength = Number(request.headers.get("content-length") ?? "0");
if (contentLength > MAX_REQUEST_BYTES) {
  return NextResponse.json(
    { error: "Payload acima do limite (30MB)." },
    { status: 413 },
  );
}
```

E reduzir `MAX_ATTACHMENTS_PER_TURN` pra 2 ou `MAX_ATTACHMENT_BYTES` pra 2MB enquanto a base é só MVP (vision API já aceita imagens de até 1568px no eixo maior — ~1MB JPEG cobre 99% dos prints de WhatsApp). Alternativa: redimensionar client-side antes do base64 encode usando `<canvas>` + `toBlob({ quality: 0.8 })`.

## Warnings

### WR-01: Memory leak — `URL.createObjectURL` não revogada no unmount

**File:** `src/components/flirt-ai-shell.tsx:413-420`
**Issue:** O cleanup effect tem `[]` deps com `eslint-disable react-hooks/exhaustive-deps`, então captura o `attachments` initial (vazio) via closure. Quando o componente unmount, esse effect itera sobre o array vazio e NÃO revoga as URLs criadas depois do mount. `removeAttachment` (405) e `handleSendMessage` (495) cobrem os casos de fluxo normal, mas se o user abre `/desenrolos/new`, anexa 4 prints, e fecha a aba sem mandar/remover, fica com 4 blob URLs leakando até navigation.

**Fix:** Usar ref pra preservar o array atual sem re-disparar o effect:

```ts
const attachmentsRef = useRef(attachments);
useEffect(() => {
  attachmentsRef.current = attachments;
}, [attachments]);

useEffect(() => {
  return () => {
    for (const attachment of attachmentsRef.current) {
      if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    }
  };
}, []);
```

### WR-02: Avatar-vision na crítica path adiciona latência ~500-1500ms ao turn

**File:** `src/app/api/coach/route.ts:270-281`
**Issue:** `extractContactAvatar` roda DEPOIS do `finalMessage()` do stream principal e ANTES do `prisma.$transaction`. É uma chamada Haiku separada (1-2s típicos) que bloqueia o `done` event e a persistência. O user vê o streaming completar, depois ~1s de "Pensando" sem visual feedback até o assistant message aparecer. Pior: se o user manda 3 turns seguidos com print antes do contact ter avatar, cada um paga essa latência.

**Fix:** Mover pra background — disparar a detecção em `Promise.resolve().then(...)` sem await no critical path. Persiste o avatar no contact direto via update separado (não na transaction principal). Sacrifica atomicidade (se DB cair entre as 2 escritas, fica sem avatar), mas isso é recuperável no próximo turn:

```ts
// dentro do start() callback, antes da transaction:
const avatarPromise = (!contact.avatarUrl && attachments.length)
  ? extractContactAvatar({ client, attachments, contactName: contact.name })
      .catch(() => null)
  : Promise.resolve(null);

// transaction sem avatar
const [, assistantMessage] = await prisma.$transaction([/* ...sem avatar... */]);
writeEvent("done", payload);

// fire-and-forget DEPOIS do done
avatarPromise.then((detected) => {
  if (detected) {
    return prisma.contact.update({
      where: { id: contactId },
      data: { avatarUrl: `data:${detected.mediaType};base64,${detected.data}` },
    }).catch(() => {});
  }
});
```

### WR-03: Anexos do user são descartados quando POST falha

**File:** `src/components/flirt-ai-shell.tsx:494-498`
**Issue:** `handleSendMessage` faz `setAttachments([])` ANTES de `await fetch(...)`. Se a request falha (rate limit 429, network error, stream error mid-flight), o catch (586) só mostra mensagem de erro — o user perde os arquivos anexados e tem que selecionar de novo. UX rim porque a `outgoingMessage` JÁ foi appended no histórico local via `appendMessage` (492), então o user vê "você: X" sem opção de retry.

**Fix:** Guardar snapshot dos attachments, limpar só após `done`/`error` final, e em caso de erro restaurar via callback:

```ts
const snapshotAttachments = attachments;
const snapshotPayloads = attachmentPayloads;
// NÃO setAttachments([]) aqui ainda
// ... fetch + stream ...
// no success branch (depois de applyCoachResponse):
for (const att of snapshotAttachments) {
  if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
}
setAttachments([]);
// no catch:
// (não restaurar — UX confusa; mas pelo menos não revogar e exibir CTA "Retry com mesmos anexos")
```

Workaround mais simples: manter como está mas mostrar mensagem de erro explicando que tem que anexar de novo.

### WR-04: `handleAttachChange` não respeita `MAX_ATTACHMENTS_PER_TURN`

**File:** `src/components/flirt-ai-shell.tsx:361-403`
**Issue:** O input tem `multiple` (1108) mas o handler aceita N arquivos sem checar o cap. Se o user seleciona 10 imagens, todas viram `ImageAttachmentState` (encodando 10 base64 em paralelo, possivelmente travando o browser), e só falha na hora do POST quando o Zod rejeita por `.max(MAX_ATTACHMENTS_PER_TURN)`. Pior: o erro Zod genérico ("Payload inválido.") não diz "você anexou demais", então user pensa que é bug.

**Fix:** Validar UI-side ao receber files + ao adicionar à fila:

```ts
const handleAttachChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(event.target.files ?? []);
  if (!files.length) return;
  event.target.value = "";

  const currentCount = attachments.length;
  const remaining = MAX_ATTACHMENTS_PER_TURN - currentCount;
  if (remaining <= 0) {
    setErrorMessage(`Máximo de ${MAX_ATTACHMENTS_PER_TURN} imagens por turno.`);
    return;
  }
  const slice = files.slice(0, remaining);
  if (files.length > remaining) {
    setErrorMessage(`Só consigo aceitar mais ${remaining} imagem(ns) neste turno.`);
  }
  for (const file of slice) {
    // ... resto do código
  }
};
```

Importar `MAX_ATTACHMENTS_PER_TURN` do `@/lib/flirt/attachments` (já está exportado).

### WR-05: AbortSignal não propagado — client cancela tab, server continua chamando Anthropic

**File:** `src/app/api/coach/route.ts:202-235` + `270-281`
**Issue:** Quando o cliente fecha a aba/cancela o fetch durante o stream, o `ReadableStream` notifica o producer via `controller.error` ou close. No código atual, o `for await (const event of stream)` continua consumindo deltas (paga tokens) e o `extractContactAvatar` (chamada Haiku separada) também não tem como saber. Em prod com Coolify, isso pode acumular wasted spend quando users fazem multi-tab abandonment.

**Fix:** Aceitar e propagar `AbortSignal` do request:

```ts
export async function POST(request: Request) {
  // ...
  const abortController = new AbortController();
  request.signal.addEventListener("abort", () => abortController.abort());

  // passar pro Anthropic SDK
  stream = client.messages.stream(
    { /* ...params... */ },
    { signal: abortController.signal },
  );

  // e pro extractContactAvatar (passar via input + usar dentro de messages.create)
```

Vale notar que o Anthropic SDK aceita `signal` no segundo param de cada chamada — `extractContactAvatar` precisa receber e propagar também.

### WR-06: Texto-síntese de prompt vazio fica visível ao user no histórico mas não foi o que ele "disse"

**File:** `src/app/api/coach/route.ts:262-266`
**Issue:** Quando o user só anexa imagem sem texto, persistimos `[${attachments.length} imagem(ns) anexada(s)]` no campo `content` da user Message. No histórico futuro carregado pra LLM (linha 137-141: `prefix + message.content`), a LLM vê literalmente "Ele: [3 imagem(ns) anexada(s)]" — perde TODO o contexto visual do print porque o base64 ficou no campo `attachments` mas o `messagesForLlm` builder (linha 137) só lê `message.content`. Em turnos futuros, o LLM responde no escuro.

**Fix:** Quando enriquecer o `messagesForLlm` a partir do histórico, se a message do user tem `attachments`, montar content[] misto reusando as imagens:

```ts
const historyMessages = await prisma.message.findMany({
  where: { contactId },
  orderBy: { createdAt: "desc" },
  take: HISTORY_CAP,
  select: { sender: true, content: true, attachments: true },
});

for (const message of [...historyMessages].reverse()) {
  const role: "user" | "assistant" = message.sender === "assistant" ? "assistant" : "user";
  const prefix = message.sender === "contact" ? "[Mensagem dela] " : "";
  const atts = (message.attachments as ImageAttachmentPayload[] | null) ?? null;
  if (atts?.length && role === "user") {
    const imageBlocks = atts.map((a): Anthropic.ImageBlockParam => ({
      type: "image",
      source: { type: "base64", media_type: a.mediaType, data: a.data },
    }));
    messagesForLlm.push({
      role,
      content: [...imageBlocks, { type: "text", text: prefix + message.content }],
    });
  } else {
    messagesForLlm.push({ role, content: prefix + message.content });
  }
}
```

CUIDADO: isso multiplica tokens de prompt rapidamente (8 turns × 4 images × ~1500 tokens = 48k tokens só de imagem). Considera limitar a imagens só do último turn ou descartar attachments > N turns atrás.

## Info

### IN-01: `contactUpdate` perde type-safety com `Record<string, unknown>`

**File:** `src/app/api/coach/route.ts:292-308`
**Issue:** Tipo `Record<string, unknown>` ao invés de `Prisma.ContactUpdateInput`. Se alguém digita `avatarURL` (typo) ao invés de `avatarUrl`, compila e silenciosamente não atualiza.
**Fix:** `const contactUpdate: Prisma.ContactUpdateInput = { ... }; if (detectedAvatar) contactUpdate.avatarUrl = ...;`. Importa `Prisma` de `@prisma/client`.

### IN-02: Swallow-error em `extractContactAvatar` mascara falhas operacionais

**File:** `src/lib/flirt/avatar-vision.ts:108-110`
**Issue:** `catch { return null; }` engole TUDO — API key inválida, modelo deprecado, rate limit Anthropic, timeout de rede. Meres confirmou que é intencional pra não bloquear o turn, mas zero observability dificulta debug em prod quando avatar nunca detecta.
**Fix:** Logar via `traceCoachCall` ou no mínimo `console.warn` em dev:

```ts
} catch (error) {
  if (process.env.NODE_ENV !== "production") {
    console.warn("[avatar-vision] detection failed:", error);
  }
  return null;
}
```

Idealmente conectar ao Langfuse já existente como sub-trace.

### IN-03: `parseCoachCommand` usa `replace` não-global

**File:** `src/lib/flirt/commands.ts:63`
**Issue:** `value.replace(known.prefix, "")` substitui só a primeira ocorrência. Não é bug real (user nunca digita "/encontro" 2x intencionalmente), mas se acontecer, sobra a 2ª no `cleanPrompt`.
**Fix:** Como o command sempre é prefixo no `startsWith` check, usar `value.slice(known.prefix.length)` é mais explícito e barato:

```ts
const cleanPrompt = value.slice(known.prefix.length).trim();
```

### IN-04: `MAX_BASE64_LENGTH` calculation tem margem mas comentário ausente

**File:** `src/lib/flirt/attachments.ts:14`
**Issue:** `Math.ceil((MAX_ATTACHMENT_BYTES * 4) / 3) + 8` — o `+ 8` é margem pra padding e CRLF, mas não tem comentário explicando. Daqui a 6 meses ninguém vai lembrar de onde veio o 8.
**Fix:** Adicionar comentário:

```ts
// base64 expande ~4/3, +8 pra cobrir padding (`==`) e possíveis CRLFs em data URLs.
const MAX_BASE64_LENGTH = Math.ceil((MAX_ATTACHMENT_BYTES * 4) / 3) + 8;
```

### IN-05: Mensagem de erro "Aguarde os anexos terminarem de carregar" persiste após o encoding terminar

**File:** `src/components/flirt-ai-shell.tsx:437-440`
**Issue:** Se o user clica Send com 1 attachment encoding, `setErrorMessage("Aguarde os anexos...")` é setado mas nunca limpado automaticamente quando o encoding completa. O user vê o erro stale até clicar Send de novo (que limpa em 493) ou digitar.
**Fix:** Limpar errorMessage em `setAttachments` callback quando todos viram "ready":

```ts
.then((payload) => {
  setAttachments((previous) => {
    const next = previous.map((a) =>
      a.id === id ? { ...a, status: "ready" as const, payload } : a,
    );
    if (next.every((a) => a.status === "ready")) {
      setErrorMessage((prev) =>
        prev === "Aguarde os anexos terminarem de carregar." ? null : prev,
      );
    }
    return next;
  });
})
```

Ou mais simples: usar `useEffect` que limpa o errorMessage específico quando `attachments.every(a => a.status !== "encoding")`.

---

_Reviewed: 2026-05-24T22:45:00Z_
_Reviewer: code-reviewer (AILA squad)_
_Depth: standard_
