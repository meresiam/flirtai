import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { runProfileScan } from "@/lib/profile-watch/cron-runner";
import { requireFreshConsent } from "@/lib/profile-watch/consent-guard";
import { checkAndConsumeRateLimit } from "@/lib/rate-limit";
import {
  serializeProfilePost,
  serializeProfileReport,
  serializeProfileSummary,
} from "@/lib/profile-watch/serializers";

type RouteContext = { params: Promise<{ id: string }> };

const SCAN_RATE_ROUTE = "profile-scan";
// Manual scan é caro (Apify + Gemini). Override do limite global.
const SCAN_LIMIT_PER_HOUR = 10;

export async function POST(_req: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { id } = await params;
  const profile = await prisma.monitoredProfile.findFirst({
    where: { id, userId },
  });
  if (!profile) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }

  if (profile.status === "paused") {
    return NextResponse.json(
      { error: "Perfil pausado. Reative antes de scanear." },
      { status: 409 },
    );
  }

  // Bloqueia scan manual se o usuário não aceitou a versão atual do termo.
  const stale = requireFreshConsent(profile);
  if (stale) return stale;

  const rate = await checkAndConsumeRateLimit(
    userId,
    SCAN_RATE_ROUTE,
    SCAN_LIMIT_PER_HOUR,
  );
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Limite de scans manuais por hora atingido." },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(
            (rate.resetAt.getTime() - Date.now()) / 1000,
          ).toString(),
        },
      },
    );
  }

  const result = await runProfileScan(profile);

  // Recarrega estado fresco pra devolver pro cliente.
  const [refreshed, latestPosts, latestReport] = await Promise.all([
    prisma.monitoredProfile.findUnique({
      where: { id },
      include: { snapshots: { orderBy: { capturedAt: "desc" }, take: 1 } },
    }),
    prisma.profilePost.findMany({
      where: { profileId: id },
      orderBy: [{ postedAt: "desc" }, { firstSeenAt: "desc" }],
      take: 30,
    }),
    prisma.profileReport.findFirst({
      where: { profileId: id },
      orderBy: { windowEnd: "desc" },
    }),
  ]);

  return NextResponse.json({
    scan: result,
    profile: refreshed ? serializeProfileSummary(refreshed) : null,
    posts: latestPosts.map(serializeProfilePost),
    latestReport: latestReport ? serializeProfileReport(latestReport) : null,
  });
}
