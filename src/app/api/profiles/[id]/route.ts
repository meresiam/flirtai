import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { requireFreshConsent } from "@/lib/profile-watch/consent-guard";
import {
  serializeCoachingSuggestion,
  serializeProfilePost,
  serializeProfileReport,
  serializeProfileSummary,
} from "@/lib/profile-watch/serializers";
import { patchProfileSchema } from "@/lib/profile-watch/zod-schemas";
import type { ProfileDetailResponse } from "@/types/profile-watch";

type RouteContext = { params: Promise<{ id: string }> };

async function findOwned(userId: string, profileId: string) {
  return prisma.monitoredProfile.findFirst({
    where: { id: profileId, userId },
  });
}

export async function GET(_req: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { id } = await params;

  const profile = await prisma.monitoredProfile.findFirst({
    where: { id, userId },
    include: {
      snapshots: { orderBy: { capturedAt: "desc" }, take: 1 },
    },
  });
  if (!profile) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }

  const [posts, reports, suggestions] = await Promise.all([
    prisma.profilePost.findMany({
      where: { profileId: id },
      orderBy: [{ postedAt: "desc" }, { firstSeenAt: "desc" }],
      take: 100,
    }),
    prisma.profileReport.findMany({
      where: { profileId: id },
      orderBy: { windowEnd: "desc" },
      take: 30,
    }),
    prisma.coachingSuggestion.findMany({
      where: { profileId: id },
      orderBy: [{ acknowledged: "asc" }, { createdAt: "desc" }],
      take: 30,
    }),
  ]);

  const payload: ProfileDetailResponse = {
    profile: serializeProfileSummary(profile),
    posts: posts.map(serializeProfilePost),
    reports: reports.map(serializeProfileReport),
    suggestions: suggestions.map(serializeCoachingSuggestion),
  };

  return NextResponse.json(payload);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { id } = await params;
  const owned = await findOwned(userId, id);
  if (!owned) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }

  let parsed;
  try {
    parsed = patchProfileSchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payload inválido.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Pausar é sempre permitido (até desejável quando consent expirou — impede coleta).
  // Ativar ou alterar cadência exigem consent atual.
  const isPauseOnly = parsed.status === "paused" && !parsed.cadenceHours;
  if (!isPauseOnly) {
    const stale = requireFreshConsent(owned);
    if (stale) return stale;
  }

  const updated = await prisma.monitoredProfile.update({
    where: { id },
    data: {
      ...(parsed.status ? { status: parsed.status } : {}),
      ...(parsed.cadenceHours ? { cadenceHours: parsed.cadenceHours } : {}),
      // Resumindo: ao reativar, limpa lastErrorMessage.
      ...(parsed.status === "active" ? { lastErrorMessage: null } : {}),
    },
    include: { snapshots: { orderBy: { capturedAt: "desc" }, take: 1 } },
  });

  return NextResponse.json({ profile: serializeProfileSummary(updated) });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { id } = await params;
  const owned = await findOwned(userId, id);
  if (!owned) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }

  await prisma.monitoredProfile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
