import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { serializeContact } from "@/lib/serializers";

type RouteContext = { params: Promise<{ id: string }> };

// W8 — soft archive (archivedAt set) + restore (archivedAt null).
// Hard delete continua via DELETE /api/contacts/[id] (não muda).
// Arquivar também despina (pinnedAt null) pra não ficar pinned-mas-escondido.

async function ensureOwned(userId: string, contactId: string) {
  return prisma.contact.findFirst({
    where: { id: contactId, userId },
  });
}

export async function POST(_request: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { id } = await params;
  const owned = await ensureOwned(userId, id);
  if (!owned) {
    return NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });
  }

  const updated = await prisma.contact.update({
    where: { id },
    data: { archivedAt: new Date(), pinnedAt: null },
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

  const updated = await prisma.contact.update({
    where: { id },
    data: { archivedAt: null },
  });

  return NextResponse.json({ contact: serializeContact(updated) });
}
