import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Única rota autenticada SEM o gate de aprovação — é ela que a página
// /aguardando usa pra saber se o cadastro já foi liberado.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { approvedAt: true, email: true },
  });

  return NextResponse.json({
    approved: Boolean(user?.approvedAt) || isAdminEmail(session.user.email),
    email: user?.email ?? session.user.email ?? null,
  });
}
