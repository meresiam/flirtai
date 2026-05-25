import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { serializeContact } from "@/lib/serializers";

type RouteContext = { params: Promise<{ id: string }> };

// W8 — cap igual ao Telegram. Tentar fixar o 6º responde 409 e o front mostra
// toast "Desfixe outro primeiro". Tem que rodar dentro de transação pra evitar
// race quando o user clica em dois cards quase ao mesmo tempo.
const PINNED_CAP = 5;

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

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const owned = await tx.contact.findFirst({
        where: { id, userId },
      });
      if (!owned) return null;
      if (owned.pinnedAt) return owned;

      const pinnedCount = await tx.contact.count({
        where: { userId, archivedAt: null, pinnedAt: { not: null } },
      });
      if (pinnedCount >= PINNED_CAP) {
        throw new Error("PINNED_CAP");
      }

      return tx.contact.update({
        where: { id },
        data: { pinnedAt: new Date() },
      });
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Contato não encontrado." },
        { status: 404 },
      );
    }
    return NextResponse.json({ contact: serializeContact(updated) });
  } catch (err) {
    if (err instanceof Error && err.message === "PINNED_CAP") {
      return NextResponse.json(
        {
          error: `Você só pode fixar até ${PINNED_CAP} conversas. Desfixe alguma primeiro.`,
          code: "PINNED_CAP",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Erro ao fixar conversa." }, { status: 500 });
  }
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
    data: { pinnedAt: null },
  });

  return NextResponse.json({ contact: serializeContact(updated) });
}
