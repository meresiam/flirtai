import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { serializeContact } from "@/lib/serializers";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  folderId: z.string().min(1).max(40).nullable(),
});

export async function PUT(request: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { id } = await params;

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const contact = await prisma.contact.findFirst({ where: { id, userId } });
  if (!contact) {
    return NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });
  }

  // Cross-user isolation: pasta tem que ser do mesmo user.
  if (parsed.folderId !== null) {
    const folder = await prisma.folder.findFirst({
      where: { id: parsed.folderId, userId },
    });
    if (!folder) {
      return NextResponse.json(
        { error: "Pasta não encontrada." },
        { status: 404 },
      );
    }
  }

  const updated = await prisma.contact.update({
    where: { id },
    data: { folderId: parsed.folderId },
  });

  return NextResponse.json({ contact: serializeContact(updated) });
}
