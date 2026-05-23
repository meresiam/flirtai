import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

/**
 * Returns the authenticated `userId` or a 401 `NextResponse`.
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
  return session.user.id;
}
