import { z } from "zod";

export const ALLOWED_IMAGE_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type AllowedImageMediaType = (typeof ALLOWED_IMAGE_MEDIA_TYPES)[number];

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_TURN = 4;
const MAX_BASE64_LENGTH = Math.ceil((MAX_ATTACHMENT_BYTES * 4) / 3) + 8;

export const imageAttachmentSchema = z.object({
  type: z.literal("image"),
  mediaType: z.enum(ALLOWED_IMAGE_MEDIA_TYPES),
  name: z.string().min(1).max(240),
  data: z.string().min(1).max(MAX_BASE64_LENGTH),
});

export type ImageAttachmentPayload = z.infer<typeof imageAttachmentSchema>;

export function isAllowedImageMediaType(
  value: string,
): value is AllowedImageMediaType {
  return (ALLOWED_IMAGE_MEDIA_TYPES as readonly string[]).includes(value);
}

export async function fileToBase64Attachment(
  file: File,
): Promise<ImageAttachmentPayload> {
  if (!isAllowedImageMediaType(file.type)) {
    throw new Error(
      `Tipo de arquivo não aceito: ${file.type || "desconhecido"}. Use PNG, JPEG, WEBP ou GIF.`,
    );
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(
      `Imagem muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB.`,
    );
  }
  const buffer = await file.arrayBuffer();
  return {
    type: "image",
    mediaType: file.type,
    name: file.name,
    data: arrayBufferToBase64(buffer),
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return globalThis.btoa(binary);
}
