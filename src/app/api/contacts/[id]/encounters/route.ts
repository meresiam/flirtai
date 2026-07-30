import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, type AttractionLevel as PrismaAttractionLevel } from "@prisma/client";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { checkAndConsumeRateLimit, recordLlmUsage } from "@/lib/rate-limit";
import {
  createGeminiClient,
  generateStructured,
  resolveGeminiModel,
} from "@/lib/llm/gemini";
import { decryptToken } from "@/lib/profile-watch/token-crypto";
import { serializeContact } from "@/lib/serializers";
import {
  encounterResponseSchema,
  encounterExtractSchema,
  type EncounterExtract,
} from "@/lib/flirt/encounter-schema";
import { RED_PATTERNS_RAW_DB_CAP } from "@/lib/flirt/me-limits";
import type {
  EncounterExtractPayload,
  EncounterRecord,
} from "@/types/flirt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const ENCOUNTERS_RATE_LIMIT_PER_HOUR = 60;
const FLAGS_CAP = 12;
const MAX_RAW_TEXT = 4000;
const LIST_LIMIT_DEFAULT = 20;
const LIST_LIMIT_MAX = 50;

const postSchema = z
  .object({
    rawText: z.string().trim().min(5).max(MAX_RAW_TEXT),
    happenedAt: z
      .string()
      .datetime({ offset: true })
      .optional(),
  })
  .strict();

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { id: contactId } = await params;

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, userId },
  });
  if (!contact) {
    return NextResponse.json(
      { error: "Contato não encontrado." },
      { status: 404 },
    );
  }

  let parsed;
  try {
    parsed = postSchema.parse(await request.json());
  } catch (cause) {
    const message =
      cause instanceof z.ZodError
        ? cause.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join(" · ")
        : "Payload inválido.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const happenedAt = parsed.happenedAt ? new Date(parsed.happenedAt) : new Date();
  // Nielsen H5 — prevenção: happenedAt não pode ser no futuro.
  if (happenedAt.getTime() > Date.now() + 60_000) {
    return NextResponse.json(
      { error: "Data do encontro não pode ser no futuro." },
      { status: 400 },
    );
  }

  const rate = await checkAndConsumeRateLimit(
    userId,
    "encounters",
    ENCOUNTERS_RATE_LIMIT_PER_HOUR,
  );
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Limite de encontros por hora atingido. Tenta de novo daqui a pouco." },
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

  // 1) Grava raw sempre (preserva dado do user mesmo se LLM falhar).
  // WR-04 — usa toEncounterPayload pra garantir o shape unico aceito pelo card.
  const degradedFallback: EncounterExtractPayload = toEncounterPayload({
    summary: parsed.rawText.slice(0, 240),
    escalation: "indefinido",
    mood: "neutro",
    nextMove: "Reler o relato manualmente — IA não conseguiu processar.",
    attractionDelta: "same",
    greenFlags: [],
    redFlags: [],
    userRedPatterns: [],
    degraded: true,
  });

  const encounter = await prisma.encounterLog.create({
    data: {
      contactId,
      happenedAt,
      rawText: parsed.rawText,
      extracted: degradedFallback as unknown as Prisma.InputJsonValue,
    },
  });

  // 2) Resolve API key (per-user encrypted ou env fallback).
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      geminiApiKeyEncrypted: true,
      geminiModel: true,
    },
  });

  const apiKey =
    (user?.geminiApiKeyEncrypted
      ? decryptToken(user.geminiApiKeyEncrypted)
      : null) || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // Sem chave: encerra com degraded ON (raw já gravado).
    const refreshedContact = await prisma.contact.findUniqueOrThrow({
      where: { id: contactId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    return NextResponse.json({
      encounter: serializeEncounter(encounter, degradedFallback),
      contact: serializeContact(refreshedContact),
      degraded: true,
      degradedReason: "Sem chave da API Gemini configurada (servidor ou /settings).",
    });
  }

  const model = resolveGeminiModel(user?.geminiModel);
  const client = createGeminiClient(apiKey);

  // 3) Call extractor sincrono.
  let extract: EncounterExtract | null = null;
  let degradedReason: string | null = null;
  try {
    const { data, usage } = await generateStructured<unknown>({
      client,
      model,
      system:
        "Voce e um EXTRATOR de sinais factuais de relatos pos-encontro (PT-BR). " +
        "Recebe contexto da Contact + relato livre do usuario e devolve JSON estruturado " +
        "no schema pedido. NAO da conselho, NAO julga, NAO inventa fatos. " +
        "Se o relato e vago, prefira 'indefinido'/'same'/arrays vazios em vez de adivinhar. " +
        "userRedPatterns so deve ser populado se o relato do USUARIO indicar padrao problematico DELE (nao dela).",
      contents: [
        {
          role: "user",
          parts: [{ text: buildExtractorPrompt(contact, parsed.rawText, happenedAt) }],
        },
      ],
      schema: encounterResponseSchema,
      maxOutputTokens: 1024,
    });

    await recordLlmUsage(rate.usageLogId, {
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheCreationTokens: usage.cacheCreationTokens,
    });

    const parsedExtract = encounterExtractSchema.safeParse(data);
    if (!parsedExtract.success) {
      degradedReason =
        "Saida do extrator fora do schema: " +
        parsedExtract.error.issues
          .slice(0, 3)
          .map((i) => i.path.join("."))
          .join(", ");
    } else {
      extract = parsedExtract.data;
    }
  } catch (cause) {
    degradedReason =
      cause instanceof Error
        ? `Falha na call Gemini: ${cause.message}`
        : "Falha desconhecida na call Gemini.";
  }

  if (!extract) {
    // Mantem fallback degraded, mas retorna 200 (raw preservado).
    const refreshedContact = await prisma.contact.findUniqueOrThrow({
      where: { id: contactId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    return NextResponse.json({
      encounter: serializeEncounter(encounter, degradedFallback),
      contact: serializeContact(refreshedContact),
      degraded: true,
      ...(degradedReason ? { degradedReason } : {}),
    });
  }

  // 4) Aplica extract no Contact + UserProfile dentro de UMA transacao interativa Serializable.
  //    CR-01: read+merge+write do mesmo Contact precisam acontecer dentro do mesmo snapshot
  //    pra evitar perda de greenFlags/redFlags/attractionLevel em POSTs concorrentes
  //    (tab duplicada, retry de rede, double-click). Em Serializable, conflito de write
  //    dispara P2034 e devolvemos 409 em PT-BR (front pede pra tentar de novo).
  // WR-04 — passa pelo mesmo helper pra garantir shape identico ao GET.
  const finalExtract: EncounterExtractPayload = toEncounterPayload({
    summary: extract.summary,
    escalation: extract.escalation,
    mood: extract.mood,
    nextMove: extract.nextMove,
    attractionDelta: extract.attractionDelta,
    greenFlags: extract.greenFlags,
    redFlags: extract.redFlags,
    userRedPatterns: extract.userRedPatterns,
  });

  try {
    await prisma.$transaction(
      async (tx) => {
        const fresh = await tx.contact.findUniqueOrThrow({
          where: { id: contactId },
          select: { greenFlags: true, redFlags: true, attractionLevel: true },
        });
        const nextGreenFlags = mergeDedupCap(fresh.greenFlags, extract.greenFlags, FLAGS_CAP);
        const nextRedFlags = mergeDedupCap(fresh.redFlags, extract.redFlags, FLAGS_CAP);
        const nextAttraction = shiftAttraction(fresh.attractionLevel, extract.attractionDelta);

        await tx.encounterLog.update({
          where: { id: encounter.id },
          data: { extracted: finalExtract as unknown as Prisma.InputJsonValue },
        });
        await tx.contact.update({
          where: { id: contactId },
          data: {
            greenFlags: nextGreenFlags,
            redFlags: nextRedFlags,
            lastInteractionSummary: extract.summary,
            attractionLevel: nextAttraction,
          },
        });

        // Integracao W6 — userRedPatterns alimenta UserProfile.redPatterns (consolidados, nao raw).
        if (extract.userRedPatterns.length > 0) {
          const profile = await tx.userProfile.upsert({
            where: { userId },
            update: {},
            create: { userId },
            select: { redPatterns: true },
          });
          const current = asStringArray(profile.redPatterns);
          const merged = mergeDedupCap(current, extract.userRedPatterns, RED_PATTERNS_RAW_DB_CAP);
          if (merged.length !== current.length) {
            await tx.userProfile.update({
              where: { userId },
              data: {
                redPatterns: merged as unknown as Prisma.InputJsonValue,
              },
            });
          }
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
    );
  } catch (cause) {
    // P2034: serialization failure / write conflict em Serializable.
    if (
      cause instanceof Prisma.PrismaClientKnownRequestError &&
      cause.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "Outro encontro foi salvo agora, tenta de novo daqui a pouco." },
        { status: 409 },
      );
    }
    throw cause;
  }

  const refreshedContact = await prisma.contact.findUniqueOrThrow({
    where: { id: contactId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json({
    encounter: serializeEncounter(encounter, finalExtract),
    contact: serializeContact(refreshedContact),
    degraded: false,
  });
}

export async function GET(request: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { id: contactId } = await params;

  const owned = await prisma.contact.findFirst({
    where: { id: contactId, userId },
    select: { id: true },
  });
  if (!owned) {
    return NextResponse.json(
      { error: "Contato não encontrado." },
      { status: 404 },
    );
  }

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit") ?? LIST_LIMIT_DEFAULT);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(1, Math.trunc(limitParam)), LIST_LIMIT_MAX)
    : LIST_LIMIT_DEFAULT;
  const beforeCursor = url.searchParams.get("before");

  const where: Prisma.EncounterLogWhereInput = { contactId };
  if (beforeCursor) {
    // Cursor stable: tupla (happenedAt, id) — quem chama passa o id do ultimo item.
    // WR-01: defesa em profundidade — re-valida ownership via nested contact.userId,
    // mesmo o contact ja tendo sido validado acima. Se algum dia esse codigo for
    // refatorado pra endpoint /api/encounters/[id] (sem contact-scope inicial),
    // o filtro nested previne cross-tenant leak.
    const cursorRow = await prisma.encounterLog.findFirst({
      where: { id: beforeCursor, contact: { id: contactId, userId } },
      select: { happenedAt: true, id: true },
    });
    if (cursorRow) {
      where.OR = [
        { happenedAt: { lt: cursorRow.happenedAt } },
        {
          happenedAt: cursorRow.happenedAt,
          id: { lt: cursorRow.id },
        },
      ];
    }
  }

  const rows = await prisma.encounterLog.findMany({
    where,
    orderBy: [{ happenedAt: "desc" }, { id: "desc" }],
    take: limit + 1, // peek na proxima pagina
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const encounters: EncounterRecord[] = slice.map((row) =>
    serializeEncounter(row, toEncounterPayload(row.extracted)),
  );
  const nextCursor = hasMore ? slice[slice.length - 1].id : null;

  return NextResponse.json({
    encounters,
    nextCursor,
  });
}

function buildExtractorPrompt(
  contact: {
    name: string;
    status: string;
    attractionLevel: string;
    personalityType: string | null;
    greenFlags: string[];
    redFlags: string[];
    interests: string[];
  },
  rawText: string,
  happenedAt: Date,
): string {
  return [
    `Contexto da Contact "${contact.name || "sem nome"}":`,
    `- Status: ${contact.status}`,
    `- Atracao estimada: ${contact.attractionLevel}`,
    `- Personalidade lida: ${contact.personalityType ?? "em leitura"}`,
    `- Interesses: ${contact.interests.length ? contact.interests.join(", ") : "—"}`,
    `- Green flags ja conhecidas: ${contact.greenFlags.length ? contact.greenFlags.join(", ") : "—"}`,
    `- Red flags ja conhecidas: ${contact.redFlags.length ? contact.redFlags.join(", ") : "—"}`,
    "",
    `Data do encontro: ${happenedAt.toISOString()}`,
    "",
    "Relato livre do usuario (homem que esta sendo aconselhado):",
    "---",
    rawText,
    "---",
    "",
    "Tarefa: chama submit_encounter_extract com o JSON estruturado. " +
      "Lembre: NAO repita flags ja conhecidas em greenFlags/redFlags — so adicione novas observadas nesse encontro. " +
      "userRedPatterns so se o RELATO indicar erro do usuario (ele insistiu/desrespeitou/cancelou/etc). " +
      "Se o relato e vago, prefira indefinido/neutro/same e arrays vazios.",
  ].join("\n");
}

function mergeDedupCap(current: string[], incoming: string[], cap: number): string[] {
  const set = new Set(current);
  const out: string[] = [...current];
  for (const item of incoming) {
    const trimmed = item.trim();
    if (!trimmed || set.has(trimmed)) continue;
    set.add(trimmed);
    out.push(trimmed);
  }
  if (out.length > cap) {
    return out.slice(out.length - cap);
  }
  return out;
}

function shiftAttraction(
  current: PrismaAttractionLevel,
  delta: "down" | "same" | "up",
): PrismaAttractionLevel {
  if (delta === "same") return current;
  const order: PrismaAttractionLevel[] = ["Low", "Medium", "High"];
  const idx = order.indexOf(current);
  const nextIdx = delta === "up" ? idx + 1 : idx - 1;
  return order[Math.max(0, Math.min(order.length - 1, nextIdx))];
}

function asStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

// WR-03 — valida enums via Set inline. Cast `as ...` aceitava qualquer string
// em runtime; row legacy ou typo do LLM (ex: "ascendente", "feliz", "rise")
// passava pro frontend e quebrava ESCALATION_LABEL[invalid] -> undefined.
const ESCALATION_SET = new Set<string>(["regrediu", "estagnou", "avancou", "indefinido"]);
const MOOD_SET = new Set<string>(["leve", "tenso", "intenso", "frustrante", "neutro"]);
const DELTA_SET = new Set<string>(["down", "same", "up"]);

function safeEnum<T extends string>(value: unknown, set: Set<string>, fallback: T): T {
  return typeof value === "string" && set.has(value) ? (value as T) : fallback;
}

// WR-04 — centraliza serializacao do shape `extracted` de EncounterRecord.
// POST (extract validado pelo Zod) e GET (leitura de DB possivelmente legacy)
// passam pelo mesmo funil — `EncounterCard` recebe shape garantido com defaults
// pros 8 campos + enums validados.
function toEncounterPayload(value: unknown): EncounterExtractPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      summary: "",
      escalation: "indefinido",
      mood: "neutro",
      nextMove: "",
      attractionDelta: "same",
      greenFlags: [],
      redFlags: [],
      userRedPatterns: [],
      degraded: true,
    };
  }
  const obj = value as Record<string, unknown>;
  return {
    summary: typeof obj.summary === "string" ? obj.summary : "",
    escalation: safeEnum(obj.escalation, ESCALATION_SET, "indefinido"),
    mood: safeEnum(obj.mood, MOOD_SET, "neutro"),
    nextMove: typeof obj.nextMove === "string" ? obj.nextMove : "",
    attractionDelta: safeEnum(obj.attractionDelta, DELTA_SET, "same"),
    greenFlags: asStringArray((obj.greenFlags ?? []) as Prisma.JsonValue),
    redFlags: asStringArray((obj.redFlags ?? []) as Prisma.JsonValue),
    userRedPatterns: asStringArray((obj.userRedPatterns ?? []) as Prisma.JsonValue),
    ...(obj.degraded === true ? { degraded: true } : {}),
  };
}

function serializeEncounter(
  row: { id: string; contactId: string; happenedAt: Date; createdAt: Date; rawText: string },
  extracted: EncounterExtractPayload,
): EncounterRecord {
  return {
    id: row.id,
    contactId: row.contactId,
    happenedAt: row.happenedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    rawText: row.rawText,
    extracted,
  };
}
