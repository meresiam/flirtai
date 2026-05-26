import { NextResponse } from "next/server";
import { ContactStatus, AttractionLevel } from "@prisma/client";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dashboard do usuário — KPIs agregados, sempre scoped por userId.
// Escopo: contatos do tipo `desenrolo` (os interesses românticos), que é onde
// status/atração/encontros fazem sentido. Tudo calculado on-read (sem cache):
// o volume por usuário é pequeno e a exatidão importa mais que microlatência.

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const contactScope = { userId, kind: "desenrolo" as const };

  const [statusGroups, attractionGroups, messagesTotal, sentIrl, encountersTotal, flagRows] =
    await Promise.all([
      prisma.contact.groupBy({
        by: ["status"],
        where: contactScope,
        _count: { _all: true },
      }),
      prisma.contact.groupBy({
        by: ["attractionLevel"],
        where: contactScope,
        _count: { _all: true },
      }),
      prisma.message.count({ where: { contact: contactScope } }),
      prisma.message.count({
        where: { sender: "user", sentIrlAt: { not: null }, contact: contactScope },
      }),
      prisma.encounterLog.count({ where: { contact: { userId } } }),
      prisma.contact.findMany({
        where: contactScope,
        select: { greenFlags: true, redFlags: true },
      }),
    ]);

  const byStatus: Record<ContactStatus, number> = {
    active: 0,
    cold: 0,
    hot_lead: 0,
  };
  for (const g of statusGroups) byStatus[g.status] = g._count._all;

  const byAttraction: Record<AttractionLevel, number> = {
    Low: 0,
    Medium: 0,
    High: 0,
  };
  for (const g of attractionGroups) byAttraction[g.attractionLevel] = g._count._all;

  const totalContacts = byStatus.active + byStatus.cold + byStatus.hot_lead;
  const greenFlags = flagRows.reduce((sum, c) => sum + c.greenFlags.length, 0);
  const redFlags = flagRows.reduce((sum, c) => sum + c.redFlags.length, 0);

  return NextResponse.json({
    stats: {
      contacts: { total: totalContacts, byStatus },
      attraction: byAttraction,
      messages: { total: messagesTotal, sentIrl },
      encounters: { total: encountersTotal, greenFlags, redFlags },
    },
  });
}
