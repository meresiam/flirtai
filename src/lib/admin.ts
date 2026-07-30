import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

/**
 * Admin = email presente em ADMIN_EMAILS (lista separada por vírgula).
 * Sem a var setada, ninguém é admin (fail-closed).
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS ?? "";
  const allowlist = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}

/**
 * Retorna o userId do admin autenticado ou um NextResponse de erro.
 * Uso idêntico ao requireUser():
 *   const result = await requireAdmin();
 *   if (result instanceof NextResponse) return result;
 */
export async function requireAdmin(): Promise<string | NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  }
  return session.user.id;
}
