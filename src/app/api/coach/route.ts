import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkAndConsumeRateLimit } from "@/lib/rate-limit";
import { buildSystemPrompt } from "@/lib/flirt/system-prompt";
import { COACH_TOOL_NAME, coachToolSchema } from "@/lib/flirt/coach-schema";
import type {
  CoachChatResponse,
  ConversationMessage,
  MessageInsight,
  ReplySuggestion,
} from "@/types/flirt";

const HISTORY_CAP = 8;

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
      select: { anthropicApiKey: true, anthropicModel: true },
    }),
    prisma.contact.findFirst({
      where: { id: contactId, userId },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: HISTORY_CAP,
        },
      },
    }),
  ]);
  if (!contact) {
    return NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });
  }

  const history = [...contact.messages].reverse();

  const apiKey = user?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Sem chave da Anthropic. Configure em /settings ou no servidor." },
      { status: 503 },
    );
  }

  const client = new Anthropic({ apiKey });
  const model = user?.anthropicModel || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

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
      "",
      `Pedido dele: ${prompt}`,
    ].join("\n"),
  });

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model,
      max_tokens: 2048,
      system: buildSystemPrompt(mode),
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
    return NextResponse.json({ error: message }, { status: status === 404 ? 500 : 502 });
  }

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
        status: llmResponse.contact.status,
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
