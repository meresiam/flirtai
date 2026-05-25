import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { serializeFolder } from "@/lib/serializers";

// W8 — Pastas pra organizar contatos. Cap 30 por user. Cor hex ou null.
const FOLDER_CAP_PER_USER = 30;
const COLOR_HEX = /^#[0-9a-fA-F]{6}$/;

const createSchema = z.object({
  name: z.string().min(1).max(60),
  color: z
    .string()
    .max(20)
    .refine((v) => v === "" || COLOR_HEX.test(v), "Cor inválida: use hex #rrggbb.")
    .nullable()
    .optional(),
  icon: z.string().max(40).nullable().optional(),
  order: z.number().int().min(0).max(999).optional(),
});

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const folders = await prisma.folder.findMany({
    where: { userId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ folders: folders.map(serializeFolder) });
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

  const count = await prisma.folder.count({ where: { userId } });
  if (count >= FOLDER_CAP_PER_USER) {
    return NextResponse.json(
      { error: `Limite de ${FOLDER_CAP_PER_USER} pastas por conta atingido.` },
      { status: 409 },
    );
  }

  try {
    const folder = await prisma.folder.create({
      data: {
        userId,
        name: parsed.name.trim(),
        color: parsed.color || null,
        icon: parsed.icon?.trim() || null,
        order: parsed.order ?? count,
      },
    });
    return NextResponse.json({ folder: serializeFolder(folder) }, { status: 201 });
  } catch (err) {
    // Prisma P2002 = unique constraint (userId, name).
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Já existe uma pasta com esse nome." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Erro ao criar pasta." }, { status: 500 });
  }
}
