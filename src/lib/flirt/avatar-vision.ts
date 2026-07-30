import type { GoogleGenAI, Part } from "@google/genai";

import { DEFAULT_GEMINI_MODEL, generateStructured } from "@/lib/llm/gemini";
import type { ImageAttachmentPayload } from "@/lib/flirt/attachments";

const AVATAR_MODEL = DEFAULT_GEMINI_MODEL;
const AVATAR_MAX_TOKENS = 320;

const avatarResponseSchema: Record<string, unknown> = {
  type: "object",
  required: ["attachmentIndex", "confidence", "reasoning"],
  properties: {
    attachmentIndex: {
      type: "integer",
      description:
        "Índice 0-based no array de imagens anexadas, ou -1 se nenhuma serve.",
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
      description: "Quão certo você está. Use high só se for um avatar/foto de perfil claro.",
    },
    reasoning: {
      type: "string",
      description: "1 frase PT-BR explicando a escolha.",
    },
  },
};

interface ExtractContactAvatarInput {
  client: GoogleGenAI;
  attachments: ImageAttachmentPayload[];
  contactName: string;
  // WR-05 — opcional pra cancelar a chamada quando o request principal
  // for abortado (client fechou aba, etc). Propagado como abortSignal do SDK.
  signal?: AbortSignal;
}

interface AvatarToolResult {
  attachmentIndex: number;
  confidence: "low" | "medium" | "high";
  reasoning: string;
}

export async function extractContactAvatar({
  client,
  attachments,
  contactName,
  signal,
}: ExtractContactAvatarInput): Promise<ImageAttachmentPayload | null> {
  if (!attachments.length) return null;

  const imageParts = attachments.map(
    (attachment): Part => ({
      inlineData: {
        mimeType: attachment.mediaType,
        data: attachment.data,
      },
    }),
  );

  const promptText = [
    `Você ajuda o usuário a setar o avatar da conversa com ${contactName || "ela"}.`,
    "",
    "Olhe as imagens anexadas e identifique se ALGUMA é uma foto de perfil dela (rosto reconhecível, enquadramento de avatar/selfie/foto de bio).",
    "",
    "REGRAS:",
    "- Print de conversa do WhatsApp/Instagram NÃO conta (mesmo que mostre a foto de perfil em miniatura no topo).",
    "- Screenshot de feed/stories também NÃO conta.",
    "- Só conta uma imagem isolada que claramente tem ela como sujeito principal e poderia ser usada como avatar.",
  ].join("\n");

  try {
    const { data: decision } = await generateStructured<AvatarToolResult>({
      client,
      model: AVATAR_MODEL,
      contents: [
        { role: "user", parts: [...imageParts, { text: promptText }] },
      ],
      schema: avatarResponseSchema,
      maxOutputTokens: AVATAR_MAX_TOKENS,
      signal,
    });

    if (
      typeof decision.attachmentIndex !== "number" ||
      decision.attachmentIndex < 0 ||
      decision.attachmentIndex >= attachments.length
    ) {
      return null;
    }
    if (decision.confidence === "low") return null;

    return attachments[decision.attachmentIndex];
  } catch {
    return null;
  }
}
