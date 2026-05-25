import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkAndConsumeRateLimit } from "@/lib/rate-limit";
import { buildSystemPrompt } from "@/lib/flirt/system-prompt";
import { COACH_TOOL_NAME, coachToolSchema } from "@/lib/flirt/coach-schema";
import { hashUserId, traceCoachCall } from "@/lib/observability/langfuse";
import { decryptToken } from "@/lib/profile-watch/token-crypto";
import { statusToDb } from "@/lib/serializers";
import type {
  CoachChatResponse,
  ConversationMessage,
  MessageInsight,
  ReplySuggestion,
} from "@/types/flirt";

const HISTORY_CAP = 20;
const SUMMARY_THRESHOLD = 30;
const SUMMARY_MODEL = "claude-haiku-4-5-20251001";

const requestSchema = z.object({
  contactId: z.string().min(1),
  prompt: z.string().min(1).max(4000),
  mode: z.enum(["incoming", "strategy"]).default("incoming"),
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const userId = session.user.id;

  let parsed;
  try {
    parsed = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }
  const { contactId, prompt, mode } = parsed;

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
      select: { anthropicApiKeyEncrypted: true, anthropicModel: true },
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
    (user?.anthropicApiKeyEncrypted
      ? decryptToken(user.anthropicApiKeyEncrypted)
      : null) || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Sem chave da Anthropic. Configure em /settings ou no servidor." },
      { status: 503 },
    );
  }

  const client = new Anthropic({ apiKey });
  const model = user?.anthropicModel || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

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

  const messagesForLlm: Anthropic.MessageParam[] = [];
  for (const message of history) {
    const role: "user" | "assistant" = message.sender === "assistant" ? "assistant" : "user";
    const prefix = message.sender === "contact" ? "[Mensagem dela] " : "";
    messagesForLlm.push({ role, content: prefix + message.content });
  }
  messagesForLlm.push({
    role: "user",
    content: [
      `Contexto atual da conversa com ${contact.name || "sem nome"}:`,
      `- Fonte: ${contact.source}`,
      `- Status: ${contact.status}`,
      `- Nível de atração estimado: ${contact.attractionLevel}`,
      `- Perfil: ${contact.personalityType ?? "em leitura"}`,
      `- Interesses: ${contact.interests.length ? contact.interests.join(", ") : "—"}`,
      `- Tags: ${contact.tags.length ? contact.tags.join(", ") : "—"}`,
      ...(conversationSummary
        ? ["", `Resumo da conversa anterior (gerado por Haiku): ${conversationSummary}`]
        : []),
      "",
      `Pedido dele: ${prompt}`,
    ].join("\n"),
  });

  const traceInput = {
    userIdHash: hashUserId(userId),
    contactId,
    model,
    mode,
  };
  const startedAt = Date.now();

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model,
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: buildSystemPrompt(mode),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: messagesForLlm,
      tools: [coachToolSchema],
      tool_choice: { type: "tool", name: COACH_TOOL_NAME },
    });
  } catch (error) {
    const status = (error as { status?: number })?.status ?? 502;
    const message =
      status === 404
        ? `Modelo "${model}" não está disponível na sua conta Anthropic. Confira ANTHROPIC_MODEL.`
        : error instanceof Error
          ? error.message
          : "O FLIRT A.I não conseguiu responder.";
    await traceCoachCall(traceInput, {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      latencyMs: Date.now() - startedAt,
      status: "error",
      errorMessage: message,
    });
    return NextResponse.json({ error: message }, { status: status === 404 ? 500 : 502 });
  }

  const usage = response.usage as Anthropic.Usage & {
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  await traceCoachCall(traceInput, {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
    latencyMs: Date.now() - startedAt,
    status: "ok",
  });

  const toolBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolBlock) {
    return NextResponse.json(
      { error: "Resposta sem tool_use. Tenta de novo." },
      { status: 502 },
    );
  }

  const llmResponse = toolBlock.input as CoachChatResponse;

  const [, assistantMessage] = await prisma.$transaction([
    prisma.message.create({
      data: { contactId, sender: "user", content: prompt },
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
      data: {
        name: llmResponse.contact.name || contact.name,
        source: llmResponse.contact.source || contact.source,
        status: statusToDb(llmResponse.contact.status),
        attractionLevel: llmResponse.contact.attractionLevel,
        personalityType: llmResponse.contact.personalityType || contact.personalityType,
        interests: llmResponse.contact.interests.length
          ? llmResponse.contact.interests
          : contact.interests,
        tags: llmResponse.contact.tags.length ? llmResponse.contact.tags : contact.tags,
        lastInteractionSummary:
          llmResponse.contact.lastInteractionSummary || prompt.slice(0, 280),
      },
    }),
  ]);

  const payload: CoachChatResponse & { messageId: string } = {
    ...llmResponse,
    suggestions: llmResponse.suggestions as ReplySuggestion[],
    insight: llmResponse.insight as MessageInsight,
    messageId: assistantMessage.id,
  };

  return NextResponse.json(payload, {
    headers: {
      "X-RateLimit-Remaining": rate.remaining.toString(),
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
  client: Anthropic,
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
    const result = await client.messages.create({
      model: SUMMARY_MODEL,
      max_tokens: 320,
      system:
        "Você resume conversas de wingman em PT-BR. 3 a 5 frases, direto, sem preâmbulo. " +
        "Foco: (a) estágio do relacionamento, (b) padrões de interação dela, " +
        "(c) leituras-chave sobre a interlocutora, (d) o que já tentaram. " +
        "NUNCA conselho ou opinião — só síntese factual.",
      messages: [
        {
          role: "user",
          content: `Resuma esta conversa entre o usuário e ${contactName || "a interlocutora"}:\n\n${transcript}`,
        },
      ],
    });
    const text = result.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    return text || null;
  } catch {
    return null;
  }
}
