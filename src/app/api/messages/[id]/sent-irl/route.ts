import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { serializeMessage } from "@/lib/serializers";

type RouteContext = { params: Promise<{ id: string }> };

// W8 — marca/desmarca uma Message como "enviada no IG/WA real".
// Multi-tenancy via Message.contact.userId (Message não tem userId direto).

async function ensureOwned(userId: string, messageId: string) {
  return prisma.message.findFirst({
    where: { id: messageId, contact: { userId } },
  });
}

export async function POST(_request: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { id } = await params;
  const owned = await ensureOwned(userId, id);
  if (!owned) {
    return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
  }
  if (owned.sender !== "user") {
    return NextResponse.json(
      { error: "Só mensagens enviadas por você podem ser marcadas como enviadas no IG." },
      { status: 400 },
    );
  }

  const updated = await prisma.message.update({
    where: { id },
    data: { sentIrlAt: new Date() },
  });

  return NextResponse.json({ message: serializeMessage(updated) });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { id } = await params;
  const owned = await ensureOwned(userId, id);
  if (!owned) {
    return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
  }

  const updated = await prisma.message.update({
    where: { id },
    data: { sentIrlAt: null },
  });

  return NextResponse.json({ message: serializeMessage(updated) });
}
