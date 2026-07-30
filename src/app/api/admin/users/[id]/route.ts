import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    action: z.enum(["approve", "revoke"]),
  })
  .strict();

export async function PATCH(request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const adminUserId = admin;

  const { id: targetId } = await params;

  let parsed;
  try {
    parsed = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  if (parsed.action === "revoke" && targetId === adminUserId) {
    return NextResponse.json(
      { error: "Você não pode revogar o próprio acesso." },
      { status: 400 },
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { approvedAt: parsed.action === "approve" ? new Date() : null },
    select: { id: true, approvedAt: true },
  });

  return NextResponse.json({
    user: {
      id: updated.id,
      approvedAt: updated.approvedAt?.toISOString() ?? null,
    },
  });
}
