import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { PROFILE_WATCH_LIMITS } from "@/lib/profile-watch/limits";
import { serializeProfileSummary } from "@/lib/profile-watch/serializers";
import { createProfileSchema } from "@/lib/profile-watch/zod-schemas";

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const profiles = await prisma.monitoredProfile.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      snapshots: {
        orderBy: { capturedAt: "desc" },
        take: 1,
      },
    },
  });

  return NextResponse.json({
    profiles: profiles.map(serializeProfileSummary),
    limits: {
      perUser: PROFILE_WATCH_LIMITS.perUser,
      currentCount: profiles.length,
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  let parsed;
  try {
    parsed = createProfileSchema.parse(await request.json());
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Payload inválido.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Limite por usuário.
  const existingCount = await prisma.monitoredProfile.count({ where: { userId } });
  if (existingCount >= PROFILE_WATCH_LIMITS.perUser) {
    return NextResponse.json(
      {
        error: `Limite de ${PROFILE_WATCH_LIMITS.perUser} perfis monitorados atingido. Pause ou remova um antes de adicionar outro.`,
      },
      { status: 403 },
    );
  }

  // SELF exige OAuth Meta (Wave 4). Bloquear no MVP.
  if (parsed.source === "self") {
    return NextResponse.json(
      {
        error:
          "Self-Coach via Instagram (OAuth Meta) ainda não foi liberado. Cadastre como concorrente ou influencer por enquanto.",
      },
      { status: 501 },
    );
  }

  // Duplicidade já é coberta pelo unique do schema, mas mensagem amigável aqui.
  const dup = await prisma.monitoredProfile.findFirst({
    where: { userId, platform: "instagram", handle: parsed.handle },
  });
  if (dup) {
    return NextResponse.json(
      { error: `Você já monitora @${parsed.handle}.` },
      { status: 409 },
    );
  }

  const now = new Date();
  const profile = await prisma.monitoredProfile.create({
    data: {
      userId,
      source: parsed.source,
      platform: "instagram",
      handle: parsed.handle,
      cadenceHours: parsed.cadenceHours,
      consentAcceptedAt: now,
      consentVersion: parsed.consentVersion,
      nextScanAt: now, // pega no próximo cron.
    },
    include: { snapshots: true },
  });

  return NextResponse.json(
    { profile: serializeProfileSummary(profile) },
    { status: 201 },
  );
}
