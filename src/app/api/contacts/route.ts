import { NextResponse } from "next/server";
import { z } from "zod";
import { ContactKind } from "@prisma/client";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { serializeContact } from "@/lib/serializers";

const ratingValue = z.number().min(0).max(10).nullable().optional();

const createSchema = z.object({
  kind: z.enum(["desenrolo", "agent_chat"]).optional(),
  name: z.string().min(1).max(120).optional(),
  source: z.string().max(120).optional(),
  avatarUrl: z.string().url().max(2048).optional().or(z.literal("")),
  age: z.number().int().min(13).max(120).nullable().optional(),
  instagramHandle: z.string().max(120).optional(),
  ratingBeleza: ratingValue,
  ratingInteligencia: ratingValue,
  ratingLealdade: ratingValue,
  ratingRespeito: ratingValue,
  ratingVestimenta: ratingValue,
  location: z.string().max(160).optional(),
  metContext: z.string().max(240).optional(),
  tags: z.array(z.string().min(1).max(40)).max(12).optional(),
  notes: z.string().max(2000).optional(),
});

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { searchParams } = new URL(request.url);
  const kindParam = searchParams.get("kind");
  const kindFilter =
    kindParam === "desenrolo" || kindParam === "agent_chat" ? kindParam : null;

  const contacts = await prisma.contact.findMany({
    where: {
      userId,
      ...(kindFilter ? { kind: kindFilter as ContactKind } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return NextResponse.json({
    contacts: contacts.map(serializeContact),
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  let parsed;
  try {
    parsed = createSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const kind: ContactKind =
    parsed.kind === "agent_chat" ? ContactKind.agent_chat : ContactKind.desenrolo;

  const fallbackName =
    kind === ContactKind.agent_chat ? "Conversa com agente" : "Sem nome";

  const avatarUrl =
    parsed.avatarUrl && parsed.avatarUrl.length > 0 ? parsed.avatarUrl : null;

  const contact = await prisma.contact.create({
    data: {
      userId,
      kind,
      name: parsed.name?.trim() || fallbackName,
      source: parsed.source?.trim() || (kind === ContactKind.agent_chat ? "Agente" : "Instagram"),
      avatarUrl,
      age: parsed.age ?? null,
      instagramHandle: parsed.instagramHandle?.trim() || null,
      ratingBeleza: parsed.ratingBeleza ?? null,
      ratingInteligencia: parsed.ratingInteligencia ?? null,
      ratingLealdade: parsed.ratingLealdade ?? null,
      ratingRespeito: parsed.ratingRespeito ?? null,
      ratingVestimenta: parsed.ratingVestimenta ?? null,
      location: parsed.location?.trim() || null,
      metContext: parsed.metContext?.trim() || null,
      tags: parsed.tags ?? [],
      notes: parsed.notes?.trim() || null,
    },
    include: { messages: true },
  });

  return NextResponse.json({ contact: serializeContact(contact) }, { status: 201 });
}
