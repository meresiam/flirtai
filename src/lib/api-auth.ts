import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminEmail } from "@/lib/admin";

/**
 * Returns the authenticated + approved `userId` or a NextResponse
 * (401 sem sessão, 403 com code "pending_approval" se o cadastro ainda não
 * foi aprovado pelo admin). Admins da allowlist passam mesmo sem approvedAt.
 * Use:
 *   const result = await requireUser();
 *   if (result instanceof NextResponse) return result;
 *   const userId = result;
 */
export async function requireUser(): Promise<string | NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!isAdminEmail(session.user.email)) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { approvedAt: true },
    });
    if (!user?.approvedAt) {
      return NextResponse.json(
        { error: "Conta aguardando aprovação.", code: "pending_approval" },
        { status: 403 },
      );
    }
  }

  return session.user.id;
}
