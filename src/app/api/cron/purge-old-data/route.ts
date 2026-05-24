// Cron handler de retenção do Profile Watch.
//
// Mesmo padrão de auth do /api/cron/profile-scan: header X-Cron-Secret
// comparado em tempo constante (timingSafeEqual). Não usa sessão de user.
//
// Recomendação de cadência: diária (0 4 * * *). Idempotente: rodar múltiplas
// vezes ao dia não causa dano, só não tem o que apagar.

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { purgeOldProfileWatchData } from "@/lib/profile-watch/purge";

function checkSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const provided = request.headers.get("x-cron-secret") ?? "";
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!checkSecret(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await purgeOldProfileWatchData();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json(
      { error: "Purge failed.", message },
      { status: 500 },
    );
  }
}
