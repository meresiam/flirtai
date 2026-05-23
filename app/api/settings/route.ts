import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

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

function maskKey(value: string | null) {
  if (!value) return null;
  if (value.length <= 8) return `••••${value.slice(-2)}`;
  return `${value.slice(0, 6)}••••${value.slice(-4)}`;
}

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const user = await prisma.user.findUnique({
    where: { id: auth },
    select: {
      id: true,
      email: true,
      name: true,
      anthropicApiKey: true,
      anthropicModel: true,
    },
  });
  if (!user) return NextResponse.json({ error: "User não encontrado." }, { status: 404 });

  return NextResponse.json({
    settings: {
      email: user.email,
      name: user.name,
      anthropicKeyMasked: maskKey(user.anthropicApiKey),
      anthropicKeySet: Boolean(user.anthropicApiKey),
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
    data.anthropicApiKey = parsed.anthropicApiKey;
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
      anthropicApiKey: true,
      anthropicModel: true,
    },
  });

  return NextResponse.json({
    settings: {
      name: updated.name,
      anthropicKeyMasked: maskKey(updated.anthropicApiKey),
      anthropicKeySet: Boolean(updated.anthropicApiKey),
      anthropicModel: updated.anthropicModel,
    },
  });
}
