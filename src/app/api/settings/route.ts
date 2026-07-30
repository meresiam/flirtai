import { NextResponse } from "next/server";
import { z } from "zod";
import { CoachTone, Prisma } from "@prisma/client";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { LOCALE_IDS, TIMEZONE_IDS } from "@/lib/flirt/locale-options";
import { encryptToken } from "@/lib/profile-watch/token-crypto";

// W5 / M8 — shape canônico de notificationPrefs.
// Mantido em sync com docs/DATA-MODEL.md (User.notificationPrefs).
const notificationPrefsSchema = z.object({
  push: z.boolean(),
  frequency: z.enum(["instant", "daily", "weekly"]),
});

// WR-03 — schema bate exatamente com o set oferecido na UI (LOCALE_IDS /
// TIMEZONE_IDS). Sem isso, regex aceitava centenas de combinações que
// o <select> não renderizava, gerando drift silencioso.
const timezoneSchema = z.enum(TIMEZONE_IDS);
const localeSchema = z.enum(LOCALE_IDS);

const patchSchema = z.object({
  geminiApiKey: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .nullable()
    .optional(),
  geminiModel: z.string().trim().min(1).max(80).nullable().optional(),
  name: z.string().min(1).max(120).optional(),
  // W5 / M8
  timezone: timezoneSchema.nullable().optional(),
  locale: localeSchema.nullable().optional(),
  coachTone: z.nativeEnum(CoachTone).nullable().optional(),
  notificationPrefs: notificationPrefsSchema.nullable().optional(),
});

const SET_MASK = "••••••••";
const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const DEFAULT_LOCALE = "pt-BR";
const DEFAULT_NOTIFICATION_PREFS = { push: false, frequency: "daily" as const };

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const user = await prisma.user.findUnique({
    where: { id: auth },
    select: {
      id: true,
      email: true,
      name: true,
      geminiApiKeyEncrypted: true,
      geminiModel: true,
      timezone: true,
      locale: true,
      coachTone: true,
      notificationPrefs: true,
    },
  });
  if (!user) return NextResponse.json({ error: "User não encontrado." }, { status: 404 });

  return NextResponse.json({
    settings: {
      email: user.email,
      name: user.name,
      geminiKeyMasked: user.geminiApiKeyEncrypted ? SET_MASK : null,
      geminiKeySet: Boolean(user.geminiApiKeyEncrypted),
      geminiModel: user.geminiModel,
      defaultModel: process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
      timezone: user.timezone,
      locale: user.locale,
      coachTone: user.coachTone,
      notificationPrefs: user.notificationPrefs,
      defaults: {
        timezone: DEFAULT_TIMEZONE,
        locale: DEFAULT_LOCALE,
        notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
      },
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  let parsed;
  try {
    parsed = patchSchema.parse(await request.json());
  } catch (cause) {
    const message =
      cause instanceof z.ZodError
        ? cause.issues.map((i) => i.message).join(" · ")
        : "Payload inválido.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const data: Prisma.UserUpdateInput = {};
  if (parsed.geminiApiKey !== undefined) {
    data.geminiApiKeyEncrypted = parsed.geminiApiKey
      ? encryptToken(parsed.geminiApiKey)
      : null;
  }
  if (parsed.geminiModel !== undefined) {
    data.geminiModel = parsed.geminiModel;
  }
  if (parsed.name !== undefined) {
    data.name = parsed.name;
  }
  if (parsed.timezone !== undefined) {
    data.timezone = parsed.timezone;
  }
  if (parsed.locale !== undefined) {
    data.locale = parsed.locale;
  }
  if (parsed.coachTone !== undefined) {
    data.coachTone = parsed.coachTone;
  }
  if (parsed.notificationPrefs !== undefined) {
    data.notificationPrefs =
      parsed.notificationPrefs === null
        ? Prisma.DbNull
        : (parsed.notificationPrefs as Prisma.InputJsonValue);
  }

  const updated = await prisma.user.update({
    where: { id: auth },
    data,
    select: {
      name: true,
      geminiApiKeyEncrypted: true,
      geminiModel: true,
      timezone: true,
      locale: true,
      coachTone: true,
      notificationPrefs: true,
    },
  });

  return NextResponse.json({
    settings: {
      name: updated.name,
      geminiKeyMasked: updated.geminiApiKeyEncrypted ? SET_MASK : null,
      geminiKeySet: Boolean(updated.geminiApiKeyEncrypted),
      geminiModel: updated.geminiModel,
      timezone: updated.timezone,
      locale: updated.locale,
      coachTone: updated.coachTone,
      notificationPrefs: updated.notificationPrefs,
    },
  });
}
