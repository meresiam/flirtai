import { NextResponse } from "next/server";

import { requireAdmin, isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { estimateCostUsd } from "@/lib/llm-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  approvedAt: string | null;
  isAdmin: boolean;
  hasOwnKey: boolean;
  contacts: number;
  messages: number;
  llmCalls: number;
  llmCalls7d: number;
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheCreation: number;
  };
  estimatedCostUsd: number;
  lastActivityAt: string | null;
}

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [users, usageByUserModel, usage7d, contactCounts, messageCounts] =
    await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          approvedAt: true,
          geminiApiKeyEncrypted: true,
        },
      }),
      prisma.usageLog.groupBy({
        by: ["userId", "model"],
        _sum: {
          inputTokens: true,
          outputTokens: true,
          cacheReadTokens: true,
          cacheCreationTokens: true,
        },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      prisma.usageLog.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: sevenDaysAgo } },
        _count: { _all: true },
      }),
      prisma.contact.groupBy({
        by: ["userId"],
        where: { kind: "desenrolo" },
        _count: { _all: true },
      }),
      prisma.$queryRaw<Array<{ userId: string; count: number }>>`
        SELECT c.user_id AS "userId", COUNT(m.id)::int AS count
        FROM message m
        JOIN contact c ON c.id = m.contact_id
        GROUP BY c.user_id
      `,
    ]);

  const calls7dByUser = new Map(usage7d.map((row) => [row.userId, row._count._all]));
  const contactsByUser = new Map(
    contactCounts.map((row) => [row.userId, row._count._all]),
  );
  const messagesByUser = new Map(messageCounts.map((row) => [row.userId, row.count]));

  const rows: AdminUserRow[] = users.map((user) => {
    const usageRows = usageByUserModel.filter((row) => row.userId === user.id);
    const tokens = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
    let llmCalls = 0;
    let estimatedCostUsd = 0;
    let lastActivityAt: Date | null = null;

    for (const row of usageRows) {
      const totals = {
        inputTokens: row._sum.inputTokens ?? 0,
        outputTokens: row._sum.outputTokens ?? 0,
        cacheReadTokens: row._sum.cacheReadTokens ?? 0,
        cacheCreationTokens: row._sum.cacheCreationTokens ?? 0,
      };
      tokens.input += totals.inputTokens;
      tokens.output += totals.outputTokens;
      tokens.cacheRead += totals.cacheReadTokens;
      tokens.cacheCreation += totals.cacheCreationTokens;
      llmCalls += row._count._all;
      estimatedCostUsd += estimateCostUsd(row.model, totals);
      const rowMax = row._max.createdAt;
      if (rowMax && (!lastActivityAt || rowMax > lastActivityAt)) {
        lastActivityAt = rowMax;
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      approvedAt: user.approvedAt?.toISOString() ?? null,
      isAdmin: isAdminEmail(user.email),
      hasOwnKey: Boolean(user.geminiApiKeyEncrypted),
      contacts: contactsByUser.get(user.id) ?? 0,
      messages: messagesByUser.get(user.id) ?? 0,
      llmCalls,
      llmCalls7d: calls7dByUser.get(user.id) ?? 0,
      tokens,
      estimatedCostUsd,
      lastActivityAt: lastActivityAt?.toISOString() ?? null,
    };
  });

  return NextResponse.json({ users: rows });
}
