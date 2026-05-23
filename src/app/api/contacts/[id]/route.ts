import { NextResponse } from "next/server";
import { z } from "zod";
import { ContactStatus } from "@prisma/client";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { serializeContact } from "@/lib/serializers";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  source: z.string().max(120).optional(),
  tags: z.array(z.string()).max(10).optional(),
  status: z.enum(["active", "cold", "hot lead"]).optional(),
  attractionLevel: z.enum(["Low", "Medium", "High"]).optional(),
  personalityType: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
});

async function ensureOwned(userId: string, contactId: string) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, userId },
  });
  return contact;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { id } = await params;
  const contact = await prisma.contact.findFirst({
    where: { id, userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!contact) {
    return NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ contact: serializeContact(contact) });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { id } = await params;
  const owned = await ensureOwned(userId, id);
  if (!owned) {
    return NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });
  }

  let parsed;
  try {
    parsed = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const { status, ...rest } = parsed;
  const data = {
    ...rest,
    ...(status
      ? { status: status === "hot lead" ? ContactStatus.hot_lead : (status as ContactStatus) }
      : {}),
  };

  const updated = await prisma.contact.update({
    where: { id },
    data,
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json({ contact: serializeContact(updated) });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { id } = await params;
  const owned = await ensureOwned(userId, id);
  if (!owned) {
    return NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });
  }

  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
