import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { CURRENT_CONSENT_VERSION } from "@/lib/profile-watch/consent-text";
import { serializeProfileSummary } from "@/lib/profile-watch/serializers";

const bodySchema = z.object({
  consentVersion: z.literal(CURRENT_CONSENT_VERSION),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { id } = await params;

  const owned = await prisma.monitoredProfile.findFirst({ where: { id, userId } });
  if (!owned) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payload inválido.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const updated = await prisma.monitoredProfile.update({
    where: { id },
    data: {
      consentAcceptedAt: new Date(),
      consentVersion: parsed.consentVersion,
    },
    include: { snapshots: { orderBy: { capturedAt: "desc" }, take: 1 } },
  });

  return NextResponse.json({ profile: serializeProfileSummary(updated) });
}
