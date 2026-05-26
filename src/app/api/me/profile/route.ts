import { NextResponse } from "next/server";
import { z } from "zod";
import { CoachTone, Prisma } from "@prisma/client";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// W6 — Memória do Homem.
// GET   → carrega (ou cria stub) UserProfile do usuário logado.
// PATCH → update parcial (Zod parse). Campos opcionais; null = nullify.
// DELETE → zera memória (arrays + dados pessoais), preserva onboardingDone.

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

const patchSchema = z
  .object({
    tone: z.nativeEnum(CoachTone).nullable().optional(),
    age: z.number().int().min(14).max(120).nullable().optional(),
    locationCity: z.string().trim().min(1).max(120).nullable().optional(),
    // Multi-seleção: array de contextos. null/[] = limpar.
    contextLife: z.array(z.enum(CONTEXT_LIFE_OPTIONS)).max(6).nullable().optional(),
    demographics: demographicsSchema.nullable().optional(),
  })
  .strict();

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const profile = await prisma.userProfile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  return NextResponse.json({
    userProfile: serialize(profile),
    options: {
      contextLife: CONTEXT_LIFE_OPTIONS,
      relationship: RELATIONSHIP_OPTIONS,
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  let parsed;
  try {
    parsed = patchSchema.parse(await request.json());
  } catch (cause) {
    const message =
      cause instanceof z.ZodError
        ? cause.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · ")
        : "Payload inválido.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Distincao semantica: campo `undefined` no parsed => nao toca o registro;
  // campo `null` no parsed => nullify explicito no DB.
  const data: Prisma.UserProfileUpdateInput = {};
  if (parsed.tone !== undefined) data.tone = parsed.tone;
  if (parsed.age !== undefined) data.age = parsed.age;
  if (parsed.locationCity !== undefined) data.locationCity = parsed.locationCity;
  // String[] non-null no DB: null/ausência de itens vira lista vazia (set).
  if (parsed.contextLife !== undefined) {
    data.contextLife = { set: parsed.contextLife ?? [] };
  }
  if (parsed.demographics !== undefined) {
    data.demographics =
      parsed.demographics === null
        ? Prisma.DbNull
        : (parsed.demographics as Prisma.InputJsonValue);
  }

  // WR-06 — Nielsen H5 (prevencao): rejeitar PATCH vazio em vez de fazer
  // noop silencioso. Mascarava bugs do front (form sem dirty check).
  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Envie ao menos um campo pra atualizar." },
      { status: 400 },
    );
  }

  const profile = await prisma.userProfile.upsert({
    where: { userId },
    update: data,
    create: { ...materializeCreate(parsed), userId },
  });

  return NextResponse.json({ userProfile: serialize(profile) });
}

export async function DELETE() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  // Preserva onboardingDone (não força wizard de novo a menos que user escolha).
  const profile = await prisma.userProfile.upsert({
    where: { userId },
    update: {
      tone: null,
      age: null,
      locationCity: null,
      contextLife: { set: [] },
      demographics: Prisma.DbNull,
      winSamples: [],
      redPatternsRaw: [],
      redPatterns: [],
    },
    create: { userId },
  });

  return NextResponse.json({ userProfile: serialize(profile) });
}

function serialize(profile: {
  userId: string;
  tone: CoachTone | null;
  age: number | null;
  locationCity: string | null;
  contextLife: string[];
  demographics: Prisma.JsonValue;
  winSamples: Prisma.JsonValue;
  redPatternsRaw: Prisma.JsonValue;
  redPatterns: Prisma.JsonValue;
  onboardingDone: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    tone: profile.tone,
    age: profile.age,
    locationCity: profile.locationCity,
    contextLife: profile.contextLife,
    demographics: profile.demographics ?? null,
    winSamples: asStringArray(profile.winSamples),
    redPatternsRaw: asStringArray(profile.redPatternsRaw),
    redPatterns: asStringArray(profile.redPatterns),
    onboardingDone: profile.onboardingDone,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

function asStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function materializeCreate(
  parsed: z.infer<typeof patchSchema>,
): Omit<Prisma.UserProfileUncheckedCreateInput, "userId"> {
  const create: Omit<Prisma.UserProfileUncheckedCreateInput, "userId"> = {};
  if (parsed.tone != null) create.tone = parsed.tone;
  if (parsed.age != null) create.age = parsed.age;
  if (parsed.locationCity != null) create.locationCity = parsed.locationCity;
  if (parsed.contextLife != null) create.contextLife = parsed.contextLife;
  // (contextLife já é string[]; create aceita o array direto)
  if (parsed.demographics != null) {
    create.demographics = parsed.demographics as Prisma.InputJsonValue;
  }
  return create;
}
