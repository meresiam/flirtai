import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ label: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { label: encodedLabel } = await params;
  const label = decodeURIComponent(encodedLabel);

  await prisma.tagPreference.deleteMany({
    where: { userId, label },
  });

  return NextResponse.json({ ok: true });
}
