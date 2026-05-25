import type Anthropic from "@anthropic-ai/sdk";

import type { ImageAttachmentPayload } from "@/lib/flirt/attachments";

const AVATAR_MODEL = "claude-haiku-4-5-20251001";
const AVATAR_TOOL_NAME = "set_contact_avatar";
const AVATAR_MAX_TOKENS = 320;

const avatarToolSchema: Anthropic.Tool = {
  name: AVATAR_TOOL_NAME,
  description:
    "Indica qual das imagens anexadas contém a foto de PERFIL dela (não a foto de uma mensagem ou print da timeline). Se nenhuma servir, retorne attachmentIndex = -1.",
  input_schema: {
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
  },
};

interface ExtractContactAvatarInput {
  client: Anthropic;
  attachments: ImageAttachmentPayload[];
  contactName: string;
  // WR-05 — opcional pra cancelar a chamada Haiku quando o request principal
  // for abortado (client fechou aba, etc). Compatível com Anthropic SDK que
  // aceita { signal } no 2º arg de messages.create.
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

  const imageBlocks = attachments.map(
    (attachment): Anthropic.ImageBlockParam => ({
      type: "image",
      source: {
        type: "base64",
        media_type: attachment.mediaType,
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
    "",
    "Use a tool set_contact_avatar pra responder.",
  ].join("\n");

  try {
    const result = await client.messages.create(
      {
        model: AVATAR_MODEL,
        max_tokens: AVATAR_MAX_TOKENS,
        tools: [avatarToolSchema],
        tool_choice: { type: "tool", name: AVATAR_TOOL_NAME },
        messages: [
          {
            role: "user",
            content: [...imageBlocks, { type: "text", text: promptText }],
          },
        ],
      },
      signal ? { signal } : undefined,
    );

    const toolBlock = result.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    if (!toolBlock) return null;

    const decision = toolBlock.input as AvatarToolResult;
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
