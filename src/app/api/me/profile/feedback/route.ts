import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { checkAndConsumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// W6 — feedback inline em SuggestionCard.
// Sem classificador LLM (decisão Wave 6): apenas grava raw. W8 consolida em padrões.
// Cap defensivo: 100 winSamples, 200 redPatternsRaw (drop oldest).

const WIN_SAMPLES_CAP = 100;
const RED_PATTERNS_RAW_CAP = 200;
const FEEDBACK_RATE_LIMIT_PER_HOUR = 120;

const requestSchema = z.object({
  messageId: z.string().min(1),
  suggestionIndex: z.number().int().min(0).max(20),
  rating: z.enum(["worked", "didnt_work"]),
});

interface SuggestionShape {
  text?: unknown;
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const rate = await checkAndConsumeRateLimit(
    userId,
    "me-feedback",
    FEEDBACK_RATE_LIMIT_PER_HOUR,
  );
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Muitos feedbacks num curto período. Tenta de novo mais tarde." },
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

  let parsed;
  try {
    parsed = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  // Carrega a Message + valida que pertence a um contato do user logado.
  const message = await prisma.message.findFirst({
    where: { id: parsed.messageId, contact: { userId } },
    select: { id: true, suggestions: true, sender: true },
  });
  if (!message) {
    return NextResponse.json(
      { error: "Mensagem não encontrada." },
      { status: 404 },
    );
  }
  if (message.sender !== "assistant") {
    return NextResponse.json(
      { error: "Feedback só vale pra sugestão do coach." },
      { status: 400 },
    );
  }

  const suggestions = Array.isArray(message.suggestions)
    ? (message.suggestions as SuggestionShape[])
    : [];
  const target = suggestions[parsed.suggestionIndex];
  const suggestionText =
    target && typeof target.text === "string" ? target.text.trim() : "";
  if (!suggestionText) {
    return NextResponse.json(
      { error: "Sugestão não encontrada nesta mensagem." },
      { status: 404 },
    );
  }

  // Carrega arrays atuais pra fazer append com cap.
  const current = await prisma.userProfile.upsert({
    where: { userId },
    update: {},
    create: { userId },
    select: { winSamples: true, redPatternsRaw: true },
  });

  // WR-01 — antes de gravar no array do rating atual, remove a mesma
  // suggestionText do array oposto pra evitar sinal contraditório no coach
  // (mesmo texto em winSamples + redPatternsRaw).
  const wins = asStringArray(current.winSamples);
  const redsRaw = asStringArray(current.redPatternsRaw);

  if (parsed.rating === "worked") {
    const cleanedReds = redsRaw.filter((v) => v !== suggestionText);
    const nextWins = appendCapped(wins, suggestionText, WIN_SAMPLES_CAP);
    await prisma.userProfile.update({
      where: { userId },
      data: {
        winSamples: nextWins as unknown as Prisma.InputJsonValue,
        ...(cleanedReds.length !== redsRaw.length
          ? {
              redPatternsRaw:
                cleanedReds as unknown as Prisma.InputJsonValue,
            }
          : {}),
      },
    });
  } else {
    const cleanedWins = wins.filter((v) => v !== suggestionText);
    const nextReds = appendCapped(redsRaw, suggestionText, RED_PATTERNS_RAW_CAP);
    await prisma.userProfile.update({
      where: { userId },
      data: {
        redPatternsRaw: nextReds as unknown as Prisma.InputJsonValue,
        ...(cleanedWins.length !== wins.length
          ? {
              winSamples:
                cleanedWins as unknown as Prisma.InputJsonValue,
            }
          : {}),
      },
    });
  }

  return NextResponse.json({ ok: true, rating: parsed.rating });
}

function asStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function appendCapped(arr: string[], item: string, cap: number): string[] {
  // WR-01 — dedup preservando posição original: se o item já está, não
  // move pro fim. Antes filter+push promovia repetições antigas pro topo
  // de recência, distorcendo o slice(-RENDER_CAP) do me-context.
  if (arr.includes(item)) return arr;
  const next = [...arr, item];
  if (next.length > cap) {
    return next.slice(next.length - cap);
  }
  return next;
}
