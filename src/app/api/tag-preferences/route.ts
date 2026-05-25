import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { serializeTagPreference } from "@/lib/serializers";

// W8 — Cores de tag user-curadas. Cap 100 por user.
const TAG_PREF_CAP_PER_USER = 100;
const COLOR_HEX = /^#[0-9a-fA-F]{6}$/;

const upsertSchema = z.object({
  label: z.string().min(1).max(40),
  color: z.string().refine((v) => COLOR_HEX.test(v), "Cor inválida: use hex #rrggbb."),
});

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const prefs = await prisma.tagPreference.findMany({
    where: { userId },
    orderBy: { label: "asc" },
  });

  return NextResponse.json({
    tagPreferences: prefs.map(serializeTagPreference),
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  let parsed;
  try {
    parsed = upsertSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const existing = await prisma.tagPreference.findUnique({
    where: { userId_label: { userId, label: parsed.label } },
  });
  if (!existing) {
    const count = await prisma.tagPreference.count({ where: { userId } });
    if (count >= TAG_PREF_CAP_PER_USER) {
      return NextResponse.json(
        { error: `Limite de ${TAG_PREF_CAP_PER_USER} tags coloridas atingido.` },
        { status: 409 },
      );
    }
  }

  const pref = await prisma.tagPreference.upsert({
    where: { userId_label: { userId, label: parsed.label } },
    update: { color: parsed.color },
    create: { userId, label: parsed.label, color: parsed.color },
  });

  return NextResponse.json({ tagPreference: serializeTagPreference(pref) });
}
