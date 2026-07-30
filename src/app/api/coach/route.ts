import { NextResponse } from "next/server";
import type { Content, GoogleGenAI, Part } from "@google/genai";
import { z } from "zod";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { checkAndConsumeRateLimit, recordLlmUsage } from "@/lib/rate-limit";
import { buildSystemPromptParts } from "@/lib/flirt/system-prompt";
import { buildMeContext } from "@/lib/flirt/me-context";
import { coachResponseSchema } from "@/lib/flirt/coach-schema";
import { extractStringField } from "@/lib/flirt/partial-json";
import {
  createGeminiClient,
  geminiErrorMessage,
  resolveGeminiModel,
  usageFromResponse,
  DEFAULT_GEMINI_MODEL,
  type LlmUsage,
} from "@/lib/llm/gemini";
import { hashUserId, traceCoachCall } from "@/lib/observability/langfuse";
import { decryptToken } from "@/lib/profile-watch/token-crypto";
import { statusToDb } from "@/lib/serializers";
import {
  imageAttachmentSchema,
  MAX_ATTACHMENTS_PER_TURN,
  type ImageAttachmentPayload,
} from "@/lib/flirt/attachments";
import { extractContactAvatar } from "@/lib/flirt/avatar-vision";
import type {
  CoachChatResponse,
  ConversationMessage,
  MessageInsight,
  ReplySuggestion,
} from "@/types/flirt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HISTORY_CAP = 20;
const SUMMARY_THRESHOLD = 30;
const SUMMARY_MODEL = DEFAULT_GEMINI_MODEL;

// CR-01 — cap de body pra evitar DoS/OOM. 4 anexos * ~7MB base64 + overhead ~= 30MB.
// Sem isso, com rate limit 60/h um cliente buggy/malicioso submete ~1.7GB/h
// e cada request reside em memoria do server (request.json + Zod copy + SDK copy).
const MAX_REQUEST_BYTES = 30 * 1024 * 1024;

const requestSchema = z
  .object({
    contactId: z.string().min(1),
    prompt: z.string().max(4000).default(""),
    mode: z.enum(["incoming", "strategy"]).default("incoming"),
    attachments: z
      .array(imageAttachmentSchema)
      .max(MAX_ATTACHMENTS_PER_TURN)
      .default([]),
  })
  .refine((value) => value.prompt.trim().length > 0 || value.attachments.length > 0, {
    message: "Envie texto ou pelo menos uma imagem.",
    path: ["prompt"],
  });

export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  // CR-01 — short-circuit ANTES de ler o body. Header Content-Length nao e
  // confiavel em 100% dos casos (chunked transfer pode omitir), mas cobre o
  // vetor de ataque tipico (curl/fetch com body pre-calculado).
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { error: "Payload acima do limite (30MB)." },
      { status: 413 },
    );
  }

  let parsed;
  try {
    parsed = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }
  const { contactId, prompt, mode, attachments } = parsed;

  const rate = await checkAndConsumeRateLimit(userId, "coach");
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Limite por hora atingido. Tenta de novo daqui a pouco." },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil((rate.resetAt.getTime() - Date.now()) / 1000).toString(),
        },
      },
    );
  }

  const [user, contact] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        geminiApiKeyEncrypted: true,
        geminiModel: true,
        coachTone: true,
        userProfile: {
          select: {
            tone: true,
            age: true,
            locationCity: true,
            contextLife: true,
            demographics: true,
            winSamples: true,
            redPatternsRaw: true,
            redPatterns: true,
            onboardingDone: true,
          },
        },
      },
    }),
    prisma.contact.findFirst({
      where: { id: contactId, userId },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: HISTORY_CAP,
        },
        _count: { select: { messages: true } },
      },
    }),
  ]);
  if (!contact) {
    return NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });
  }

  const history = [...contact.messages].reverse();

  const apiKey =
    (user?.geminiApiKeyEncrypted
      ? decryptToken(user.geminiApiKeyEncrypted)
      : null) || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Sem chave da API Gemini. Configure em /settings ou no servidor." },
      { status: 503 },
    );
  }

  const client = createGeminiClient(apiKey);
  const model = resolveGeminiModel(user?.geminiModel);

  let conversationSummary = contact.conversationSummary;
  if (
    !conversationSummary &&
    contact._count.messages > SUMMARY_THRESHOLD
  ) {
    conversationSummary = await generateConversationSummary(
      client,
      contact.id,
      contact.name,
    );
    if (conversationSummary) {
      await prisma.contact.update({
        where: { id: contactId },
        data: { conversationSummary },
      });
    }
  }

  // WR-06 — re-injeta imagens do histórico SÓ no último turn do user. Sem
  // isso, o LLM via "[3 imagem(ns) anexada(s)]" no histórico e perdia todo
  // contexto visual em turns subsequentes. Limitar ao último turn evita
  // blow-up de tokens (8 turns * 4 imgs * ~1500 tokens ~= 48k).
  const lastUserHistoryIndex = (() => {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].sender === "user") return i;
    }
    return -1;
  })();

  const messagesForLlm: Content[] = [];
  for (let i = 0; i < history.length; i++) {
    const message = history[i];
    const role: "user" | "model" = message.sender === "assistant" ? "model" : "user";
    const prefix = message.sender === "contact" ? "[Mensagem dela] " : "";
    const text = prefix + message.content;

    const rawAtts = message.attachments as unknown;
    const historyAtts =
      i === lastUserHistoryIndex && Array.isArray(rawAtts)
        ? (rawAtts as ImageAttachmentPayload[]).filter(
            (a) =>
              a &&
              typeof a === "object" &&
              a.type === "image" &&
              typeof a.data === "string" &&
              typeof a.mediaType === "string",
          )
        : [];

    if (role === "user" && historyAtts.length) {
      const imageParts = historyAtts.map(
        (a): Part => ({
          inlineData: { mimeType: a.mediaType, data: a.data },
        }),
      );
      messagesForLlm.push({
        role,
        parts: [...imageParts, { text }],
      });
    } else {
      messagesForLlm.push({ role, parts: [{ text }] });
    }
  }

  const contextText = [
    `Contexto atual da conversa com ${contact.name || "sem nome"}:`,
    `- Fonte: ${contact.source}`,
    `- Status: ${contact.status}`,
    `- Nível de atração estimado: ${contact.attractionLevel}`,
    `- Perfil: ${contact.personalityType ?? "em leitura"}`,
    `- Interesses: ${contact.interests.length ? contact.interests.join(", ") : "—"}`,
    `- Tags: ${contact.tags.length ? contact.tags.join(", ") : "—"}`,
    ...(conversationSummary
      ? ["", `Resumo da conversa anterior (gerado automaticamente): ${conversationSummary}`]
      : []),
    ...(attachments.length
      ? [
          "",
          `Ele anexou ${attachments.length} imagem(ns) (provavelmente print da conversa dela). Lê com atenção antes de responder.`,
        ]
      : []),
    "",
    `Pedido dele: ${prompt.trim() || "(sem texto — interpreta o print acima)"}`,
  ].join("\n");

  if (attachments.length) {
    const imageParts = attachments.map(
      (attachment): Part => ({
        inlineData: {
          mimeType: attachment.mediaType,
          data: attachment.data,
        },
      }),
    );
    messagesForLlm.push({
      role: "user",
      parts: [...imageParts, { text: contextText }],
    });
  } else {
    messagesForLlm.push({ role: "user", parts: [{ text: contextText }] });
  }

  const traceInput = {
    userIdHash: hashUserId(userId),
    contactId,
    model,
    mode,
  };
  const startedAt = Date.now();
  const rateRemaining = rate.remaining.toString();

  const sseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const writeEvent = (event: string, data: object) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        // System prompt em string única: base estável + me-context por user +
        // tone addendum. O cache de prefixo do Gemini é implícito (sem
        // cache_control manual) — manter o bloco estável no INÍCIO preserva
        // hit de cache entre turns.
        //
        // W6 — tone resolution: userProfile.tone (W6 override fino) >
        // user.coachTone (W5 default global) > null.
        const effectiveTone = user?.userProfile?.tone ?? user?.coachTone ?? null;
        const { base, toneAddendum } = buildSystemPromptParts(mode, effectiveTone);
        const meContextBlock = buildMeContext(user?.userProfile ?? null);

        const systemInstruction = [base, meContextBlock, toneAddendum]
          .filter(Boolean)
          .join("\n\n");

        // WR-05 — propaga AbortSignal do request pro SDK. Quando o client
        // fecha a aba/cancela o fetch, o stream do Gemini é abortado
        // (para de pagar tokens) e o extractContactAvatar em background
        // também recebe o sinal.
        const stream = await client.models.generateContentStream({
          model,
          contents: messagesForLlm,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseJsonSchema: coachResponseSchema,
            maxOutputTokens: 2048,
            abortSignal: request.signal,
          },
        });

        let accumulatedJson = "";
        let sentLength = 0;
        let usage: LlmUsage = usageFromResponse(undefined);

        for await (const chunk of stream) {
          const delta = chunk.text;
          if (delta) {
            accumulatedJson += delta;
            const text = extractStringField(accumulatedJson, "assistantMessage");
            if (text.length > sentLength) {
              writeEvent("delta", { text: text.slice(sentLength) });
              sentLength = text.length;
            }
          }
          if (chunk.usageMetadata) {
            usage = usageFromResponse(chunk.usageMetadata);
          }
        }

        await traceCoachCall(traceInput, {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadTokens: usage.cacheReadTokens,
          cacheCreationTokens: usage.cacheCreationTokens,
          latencyMs: Date.now() - startedAt,
          status: "ok",
        });
        // Persiste tokens na linha do UsageLog (base do /admin de gastos).
        await recordLlmUsage(rate.usageLogId, {
          model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadTokens: usage.cacheReadTokens,
          cacheCreationTokens: usage.cacheCreationTokens,
        });

        let llmResponse: CoachChatResponse;
        try {
          llmResponse = JSON.parse(accumulatedJson) as CoachChatResponse;
        } catch {
          writeEvent("error", {
            message: "Resposta fora do formato esperado. Tenta de novo.",
            status: 502,
          });
          return;
        }
        if (!llmResponse?.assistantMessage || !llmResponse.contact) {
          writeEvent("error", {
            message: "Resposta incompleta do modelo. Tenta de novo.",
            status: 502,
          });
          return;
        }

        const persistedUserPrompt =
          prompt.trim() ||
          (attachments.length
            ? `[${attachments.length} imagem(ns) anexada(s)]`
            : "");

        const userAttachmentsForDb = attachments.length
          ? attachments.map((attachment) => ({
              type: attachment.type,
              mediaType: attachment.mediaType,
              name: attachment.name,
              data: attachment.data,
            }))
          : null;

        const contactUpdate: Record<string, unknown> = {
          name: llmResponse.contact.name || contact.name,
          source: llmResponse.contact.source || contact.source,
          status: statusToDb(llmResponse.contact.status),
          attractionLevel: llmResponse.contact.attractionLevel,
          personalityType:
            llmResponse.contact.personalityType || contact.personalityType,
          interests: llmResponse.contact.interests?.length
            ? llmResponse.contact.interests
            : contact.interests,
          tags: llmResponse.contact.tags?.length
            ? llmResponse.contact.tags
            : contact.tags,
          lastInteractionSummary:
            llmResponse.contact.lastInteractionSummary ||
            persistedUserPrompt.slice(0, 280),
        };

        const [, assistantMessage] = await prisma.$transaction([
          prisma.message.create({
            data: {
              contactId,
              sender: "user",
              content: persistedUserPrompt,
              attachments: userAttachmentsForDb as unknown as object,
            },
          }),
          prisma.message.create({
            data: {
              contactId,
              sender: "assistant",
              content: llmResponse.assistantMessage,
              suggestions: llmResponse.suggestions as unknown as object,
              insight: llmResponse.insight as unknown as object,
            },
          }),
          prisma.contact.update({
            where: { id: contactId },
            data: contactUpdate,
          }),
        ]);

        const payload: CoachChatResponse & { messageId: string } = {
          ...llmResponse,
          suggestions: llmResponse.suggestions as ReplySuggestion[],
          insight: llmResponse.insight as MessageInsight,
          messageId: assistantMessage.id,
        };

        writeEvent("done", payload);

        // WR-02 — avatar-vision sai do critical path. Roda em background
        // DEPOIS do "done" pra não bloquear o turno com latência extra de
        // uma segunda call de visão. Persiste em update separado (sacrifica
        // atomicidade, recuperável no próximo turn). Falhas são silenciosas.
        // WR-05 — propaga request.signal pra cancelar a chamada se
        // o client abortar (tab close, etc).
        if (!contact.avatarUrl && attachments.length) {
          extractContactAvatar({
            client,
            attachments,
            contactName: contact.name,
            signal: request.signal,
          })
            .then((detected) => {
              if (!detected) return;
              return prisma.contact.update({
                where: { id: contactId },
                data: {
                  avatarUrl: `data:${detected.mediaType};base64,${detected.data}`,
                },
              });
            })
            .catch(() => {
              // swallow — recuperável no próximo turn
            });
        }
      } catch (error) {
        const status = (error as { status?: number })?.status ?? 502;
        const message = geminiErrorMessage(error, model);
        await traceCoachCall(traceInput, {
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          latencyMs: Date.now() - startedAt,
          status: "error",
          errorMessage: message,
        });
        writeEvent("error", {
          message,
          status: status === 404 ? 500 : 502,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(sseStream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-RateLimit-Remaining": rateRemaining,
    },
  });
}

// Helper exposto pra eventual SSE/streaming futuro
export type CoachConversationMessage = ConversationMessage;

// W1/C5 rolling summary: roda 1x por contato quando o histórico passa
// SUMMARY_THRESHOLD (30) mensagens E ainda não foi resumido. Persistido em
// `Contact.conversationSummary` e injetado no contexto do coach turn pra
// dar memória sem inflar o prompt.
async function generateConversationSummary(
  client: GoogleGenAI,
  contactId: string,
  contactName: string,
): Promise<string | null> {
  const messages = await prisma.message.findMany({
    where: { contactId },
    orderBy: { createdAt: "asc" },
    take: 80,
    select: { sender: true, content: true },
  });
  if (messages.length === 0) return null;

  const transcript = messages
    .map((m) => {
      const speaker =
        m.sender === "assistant"
          ? "[Coach]"
          : m.sender === "contact"
            ? `[${contactName || "Ela"}]`
            : "[Ele]";
      return `${speaker} ${m.content}`;
    })
    .join("\n");

  try {
    const result = await client.models.generateContent({
      model: SUMMARY_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Resuma esta conversa entre o usuário e ${contactName || "a interlocutora"}:\n\n${transcript}`,
            },
          ],
        },
      ],
      config: {
        systemInstruction:
          "Você resume conversas de wingman em PT-BR. 3 a 5 frases, direto, sem preâmbulo. " +
          "Foco: (a) estágio do relacionamento, (b) padrões de interação dela, " +
          "(c) leituras-chave sobre a interlocutora, (d) o que já tentaram. " +
          "NUNCA conselho ou opinião — só síntese factual.",
        maxOutputTokens: 320,
      },
    });
    const text = result.text?.trim();
    return text || null;
  } catch {
    return null;
  }
}
