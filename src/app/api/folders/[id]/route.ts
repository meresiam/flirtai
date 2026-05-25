import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { serializeFolder } from "@/lib/serializers";

type RouteContext = { params: Promise<{ id: string }> };

const COLOR_HEX = /^#[0-9a-fA-F]{6}$/;

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  color: z
    .string()
    .max(20)
    .refine((v) => v === "" || COLOR_HEX.test(v), "Cor inválida: use hex #rrggbb.")
    .nullable()
    .optional(),
  icon: z.string().max(40).nullable().optional(),
  order: z.number().int().min(0).max(999).optional(),
});

async function ensureOwned(userId: string, folderId: string) {
  return prisma.folder.findFirst({ where: { id: folderId, userId } });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { id } = await params;
  const owned = await ensureOwned(userId, id);
  if (!owned) {
    return NextResponse.json({ error: "Pasta não encontrada." }, { status: 404 });
  }

  let parsed;
  try {
    parsed = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  try {
    const folder = await prisma.folder.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name.trim() } : {}),
        ...(parsed.color !== undefined
          ? { color: parsed.color === "" ? null : parsed.color }
          : {}),
        ...(parsed.icon !== undefined
          ? { icon: parsed.icon === null ? null : parsed.icon.trim() || null }
          : {}),
        ...(parsed.order !== undefined ? { order: parsed.order } : {}),
      },
    });
    return NextResponse.json({ folder: serializeFolder(folder) });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Já existe uma pasta com esse nome." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Erro ao atualizar pasta." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { id } = await params;
  const owned = await ensureOwned(userId, id);
  if (!owned) {
    return NextResponse.json({ error: "Pasta não encontrada." }, { status: 404 });
  }

  // FK em Contact.folderId tem onDelete: SetNull, então os contacts ficam
  // sem pasta automaticamente.
  await prisma.folder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
