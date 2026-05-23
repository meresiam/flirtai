import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { serializeCoachingSuggestion } from "@/lib/profile-watch/serializers";
import { ackSuggestionSchema } from "@/lib/profile-watch/zod-schemas";

type RouteContext = {
  params: Promise<{ id: string; suggestionId: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { id, suggestionId } = await params;

  const profile = await prisma.monitoredProfile.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }

  const suggestion = await prisma.coachingSuggestion.findFirst({
    where: { id: suggestionId, profileId: id },
  });
  if (!suggestion) {
    return NextResponse.json({ error: "Sugestão não encontrada." }, { status: 404 });
  }

  let parsed;
  try {
    parsed = ackSuggestionSchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payload inválido.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const updated = await prisma.coachingSuggestion.update({
    where: { id: suggestionId },
    data: { acknowledged: parsed.acknowledged },
  });

  return NextResponse.json({ suggestion: serializeCoachingSuggestion(updated) });
}
