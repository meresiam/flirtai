import { NextResponse } from "next/server";
import { z } from "zod";
import { CoachTone, Prisma } from "@prisma/client";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// W6 — onboarding 6-perguntas. Idempotente (chamar 2x atualiza, não duplica).
// Sempre seta onboardingDone=true ao fim (mesmo que payload venha vazio = skip).

const CONTEXT_LIFE_OPTIONS = [
  "universitário",
  "corporativo",
  "autônomo",
  "atleta",
  "criativo",
  "outro",
] as const;

const RELATIONSHIP_OPTIONS = [
  "solteiro",
  "namorando",
  "casado",
  "divorciado",
  "viuvo",
] as const;

const demographicsSchema = z
  .object({
    relationship: z.enum(RELATIONSHIP_OPTIONS).optional(),
    kids: z.number().int().min(0).max(20).optional(),
  })
  .strict();

const requestSchema = z
  .object({
    tone: z.nativeEnum(CoachTone).nullable().optional(),
    age: z.number().int().min(14).max(120).nullable().optional(),
    locationCity: z.string().trim().min(1).max(120).nullable().optional(),
    contextLife: z.enum(CONTEXT_LIFE_OPTIONS).nullable().optional(),
    demographics: demographicsSchema.nullable().optional(),
    skipped: z.boolean().default(false),
  })
  .strict();

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  let parsed;
  try {
    parsed = requestSchema.parse(await request.json());
  } catch (cause) {
    const message =
      cause instanceof z.ZodError
        ? cause.issues.map((i) => i.message).join(" · ")
        : "Payload inválido.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const data: Prisma.UserProfileUpdateInput = { onboardingDone: true };
  const create: Prisma.UserProfileUncheckedCreateInput = {
    userId,
    onboardingDone: true,
  };

  if (!parsed.skipped) {
    if (parsed.tone !== undefined) {
      data.tone = parsed.tone;
      if (parsed.tone != null) create.tone = parsed.tone;
    }
    if (parsed.age !== undefined) {
      data.age = parsed.age;
      if (parsed.age != null) create.age = parsed.age;
    }
    if (parsed.locationCity !== undefined) {
      data.locationCity = parsed.locationCity;
      if (parsed.locationCity != null) create.locationCity = parsed.locationCity;
    }
    if (parsed.contextLife !== undefined) {
      data.contextLife = parsed.contextLife;
      if (parsed.contextLife != null) create.contextLife = parsed.contextLife;
    }
    if (parsed.demographics !== undefined) {
      data.demographics =
        parsed.demographics === null
          ? Prisma.DbNull
          : (parsed.demographics as Prisma.InputJsonValue);
      if (parsed.demographics != null) {
        create.demographics = parsed.demographics as Prisma.InputJsonValue;
      }
    }
  }

  const profile = await prisma.userProfile.upsert({
    where: { userId },
    update: data,
    create,
  });

  return NextResponse.json({
    userProfile: {
      tone: profile.tone,
      age: profile.age,
      locationCity: profile.locationCity,
      contextLife: profile.contextLife,
      demographics: profile.demographics ?? null,
      onboardingDone: profile.onboardingDone,
    },
  });
}
