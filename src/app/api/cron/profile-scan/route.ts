// Cron handler do Profile Watch.
//
// Não usa sessão de user — é chamado por scheduler externo (Coolify cron,
// cron-job.org, etc.). Autenticação via header X-Cron-Secret contra env
// CRON_SECRET. Bounded a PROFILE_WATCH_BATCH_SIZE profiles por chamada.
//
// Idempotente: roda dependendo de nextScanAt no DB, então chamar a cada
// poucos minutos é seguro.

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/db";
import { runProfileScan, type ScanResult } from "@/lib/profile-watch/cron-runner";
import { PROFILE_WATCH_LIMITS } from "@/lib/profile-watch/limits";

const CONCURRENCY = 3;

function checkSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const provided = request.headers.get("x-cron-secret") ?? "";
  // timingSafeEqual exige mesmo length.
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function processInParallel<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<ScanResult>,
): Promise<ScanResult[]> {
  const results: ScanResult[] = [];
  let cursor = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results.push(await worker(items[idx]));
    }
  });

  await Promise.all(runners);
  return results;
}

export async function POST(request: Request) {
  if (!checkSecret(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  const due = await prisma.monitoredProfile.findMany({
    where: {
      status: "active",
      OR: [{ nextScanAt: null }, { nextScanAt: { lte: now } }],
    },
    orderBy: { nextScanAt: { sort: "asc", nulls: "first" } },
    take: PROFILE_WATCH_LIMITS.cronBatchSize,
  });

  if (due.length === 0) {
    return NextResponse.json({
      processed: 0,
      reportsCreated: 0,
      errors: 0,
      results: [],
    });
  }

  const results = await processInParallel(due, CONCURRENCY, runProfileScan);

  const reportsCreated = results.filter((r) => r.reportCreated).length;
  const errors = results.filter((r) => !r.ok).length;

  return NextResponse.json({
    processed: results.length,
    reportsCreated,
    errors,
    results,
  });
}
