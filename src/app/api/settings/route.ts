import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { encryptToken } from "@/lib/profile-watch/token-crypto";

const patchSchema = z.object({
  anthropicApiKey: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .nullable()
    .optional(),
  anthropicModel: z.string().trim().min(1).max(80).nullable().optional(),
  name: z.string().min(1).max(120).optional(),
});

const SET_MASK = "••••••••";

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const user = await prisma.user.findUnique({
    where: { id: auth },
    select: {
      id: true,
      email: true,
      name: true,
      anthropicApiKeyEncrypted: true,
      anthropicModel: true,
    },
  });
  if (!user) return NextResponse.json({ error: "User não encontrado." }, { status: 404 });

  return NextResponse.json({
    settings: {
      email: user.email,
      name: user.name,
      anthropicKeyMasked: user.anthropicApiKeyEncrypted ? SET_MASK : null,
      anthropicKeySet: Boolean(user.anthropicApiKeyEncrypted),
      anthropicModel: user.anthropicModel,
      defaultModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  let parsed;
  try {
    parsed = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const data: Record<string, string | null> = {};
  if (parsed.anthropicApiKey !== undefined) {
    data.anthropicApiKeyEncrypted = parsed.anthropicApiKey
      ? encryptToken(parsed.anthropicApiKey)
      : null;
  }
  if (parsed.anthropicModel !== undefined) {
    data.anthropicModel = parsed.anthropicModel;
  }
  if (parsed.name !== undefined) {
    data.name = parsed.name;
  }

  const updated = await prisma.user.update({
    where: { id: auth },
    data,
    select: {
      name: true,
      anthropicApiKeyEncrypted: true,
      anthropicModel: true,
    },
  });

  return NextResponse.json({
    settings: {
      name: updated.name,
      anthropicKeyMasked: updated.anthropicApiKeyEncrypted ? SET_MASK : null,
      anthropicKeySet: Boolean(updated.anthropicApiKeyEncrypted),
      anthropicModel: updated.anthropicModel,
    },
  });
}
