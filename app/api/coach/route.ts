import OpenAI from "openai";
import { NextResponse } from "next/server";

import { FLIRT_AI_SYSTEM_PROMPT } from "@/lib/flirt/system-prompt";
import type { CoachChatResponse, CoachRequest } from "@/types/flirt";

const coachChatSchema = {
  type: "object",
  additionalProperties: false,
  required: ["assistantMessage", "suggestions", "insight", "contact"],
  properties: {
    assistantMessage: { type: "string" },
    suggestions: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tone", "text", "why"],
        properties: {
          tone: {
            type: "string",
            enum: ["playful", "confident", "intriguing", "direct"],
          },
          text: { type: "string" },
          why: { type: "string" },
        },
      },
    },
    insight: {
      type: "object",
      additionalProperties: false,
      required: ["interestLevel", "read", "move", "avoid"],
      properties: {
        interestLevel: {
          type: "string",
          enum: ["Low", "Medium", "High"],
        },
        read: { type: "string" },
        move: { type: "string" },
        avoid: { type: "string" },
      },
    },
    contact: {
      type: "object",
      additionalProperties: false,
      required: [
        "name",
        "source",
        "status",
        "attractionLevel",
        "personalityType",
        "interests",
        "tags",
        "lastInteractionSummary",
      ],
      properties: {
        name: { type: "string" },
        source: { type: "string" },
        status: {
          type: "string",
          enum: ["active", "cold", "hot lead"],
        },
        attractionLevel: {
          type: "string",
          enum: ["Low", "Medium", "High"],
        },
        personalityType: { type: "string" },
        interests: {
          type: "array",
          maxItems: 6,
          items: { type: "string" },
        },
        tags: {
          type: "array",
          maxItems: 4,
          items: { type: "string" },
        },
        lastInteractionSummary: { type: "string" },
      },
    },
  },
} as const;

function buildFallbackResponse(payload: CoachRequest): CoachChatResponse {
  const name =
    payload.contact.name &&
    payload.contact.name !== "Nova conversa" &&
    payload.contact.name !== "Sem nome"
      ? payload.contact.name
      : "Sem nome";

  const suggestions = [
    {
      tone: "confident" as const,
      text: "Quinta funciona. 20h, vinho ou café?",
      why: "Curto, claro e fácil de aceitar.",
    },
    {
      tone: "playful" as const,
      text: "Quarta ou quinta eu consigo. Escolhe qual versão sua eu conhece primeiro.",
      why: "Mantém leveza com direção.",
    },
    {
      tone: "direct" as const,
      text: "Tenho quinta à noite livre. Vamos facilitar e resolver isso com um drink.",
      why: "Fecha o plano sem exagerar.",
    },
  ];

  return {
    assistantMessage:
      "Sinal bom. Ela abriu espaço para você liderar sem parecer emocionado. A melhor linha aqui é curta, leve e com direção.\n\nEu iria de: 'Quinta funciona. 20h, vinho ou café?'\n\nSe quiser, eu deixo mais provocativa, mais seca ou mais natural.",
    suggestions,
    insight: {
      interestLevel: "High",
      read: "Ela está investindo e te deu abertura para conduzir.",
      move: "Responder curto e já trazer duas opções simples.",
      avoid: "Texto longo, empolgação demais ou deixar tudo na mão dela.",
    },
    contact: {
      name,
      source: payload.contact.source || "Origem indefinida",
      status: payload.contact.status || "active",
      attractionLevel: payload.contact.attractionLevel || "Medium",
      personalityType: payload.contact.personalityType || "Perfil em leitura",
      interests: payload.contact.interests || [],
      tags: payload.contact.tags.length ? payload.contact.tags : ["Novo"],
      lastInteractionSummary: payload.prompt,
    },
  };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CoachRequest;

    if (!payload.prompt?.trim()) {
      return NextResponse.json(
        { error: "A mensagem para o FLIRT A.I está vazia." },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL ?? "gpt-5";

    if (!apiKey) {
      return NextResponse.json(buildFallbackResponse(payload));
    }

    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: `${FLIRT_AI_SYSTEM_PROMPT}

You are powering a chat-first UI. Reply in Brazilian Portuguese unless the user is clearly speaking another language.

Important behavior:
- Keep the answer conversational and compact, as a chat bubble, not a dashboard.
- Give practical flirt coaching, grounded in confidence, authenticity, respect, emotional intelligence, and timing.
- Sound like a sharp Brazilian wingman, not a generic assistant.
- Use simple words. No overexplaining. No "ChatGPT" phrasing.
- If the user pasted her message, explain the read briefly and then give 3 to 5 ready-to-send reply options.
- Suggestions must sound like real messages a confident guy would actually send.
- Avoid generic filler, artificial lines, or overly polished phrasing.
- Each suggestion should be concise, practical, and easy to copy.
- The sidebar profile must be inferred from context. Update name, source, status, attractionLevel, tags, personalityType, interests, and lastInteractionSummary.
- If a fact is unknown, preserve the current value instead of inventing specific details.
- If the current name is generic and the user reveals her name, update it.
- Never recommend manipulation, harassment, pressure, dishonesty, spam, obsession, humiliation, or treating women like possessions.
- If interest is clearly weak, say so and advise reducing investment or moving on.
- Keep replies masculine, light, provocative when appropriate, and never needy.
- Infer the best tone from the conversation itself. Do not rely on any manual style or coach toggle.
- Fill the insight object with:
  - interestLevel: Low, Medium, or High
  - read: one short read on what her behavior indicates
  - move: one short next move
  - avoid: one short warning
- assistantMessage should read naturally in chat, with short paragraphs and optional numbered options.`,
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "flirt_chat_response",
          schema: coachChatSchema,
          strict: true,
        },
      },
    });

    const outputText = response.output_text?.trim();
    if (!outputText) {
      throw new Error("A OpenAI retornou uma resposta vazia.");
    }

    const parsed = JSON.parse(outputText) as CoachChatResponse;

    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "O FLIRT A.I não conseguiu responder agora.",
      },
      { status: 500 },
    );
  }
}
