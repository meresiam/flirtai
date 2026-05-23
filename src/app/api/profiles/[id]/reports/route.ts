import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { serializeProfileReport } from "@/lib/profile-watch/serializers";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { id } = await params;
  const owned = await prisma.monitoredProfile.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!owned) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }

  const url = new URL(request.url);
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const from = fromRaw ? new Date(fromRaw) : null;
  const to = toRaw ? new Date(toRaw) : null;

  const reports = await prisma.profileReport.findMany({
    where: {
      profileId: id,
      ...(from && !Number.isNaN(from.getTime())
        ? { windowEnd: { gte: from } }
        : {}),
      ...(to && !Number.isNaN(to.getTime()) ? { windowEnd: { lte: to } } : {}),
    },
    orderBy: { windowEnd: "desc" },
    take: 100,
  });

  return NextResponse.json({ reports: reports.map(serializeProfileReport) });
}
