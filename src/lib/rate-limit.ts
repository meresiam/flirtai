import { prisma } from "@/lib/db";

const DEFAULT_LIMIT_PER_HOUR = 60;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: Date;
}

export async function checkAndConsumeRateLimit(
  userId: string,
  route: string,
  overrideLimit?: number,
): Promise<RateLimitResult> {
  const limit =
    overrideLimit ??
    Number(process.env.RATE_LIMIT_PER_HOUR ?? DEFAULT_LIMIT_PER_HOUR);
  const windowStart = new Date(Date.now() - 60 * 60 * 1000);

  const used = await prisma.usageLog.count({
    where: {
      userId,
      route,
      createdAt: { gte: windowStart },
    },
  });

  const resetAt = new Date(Date.now() + 60 * 60 * 1000);

  if (used >= limit) {
    return { ok: false, remaining: 0, resetAt };
  }

  await prisma.usageLog.create({
    data: { userId, route },
  });

  return { ok: true, remaining: limit - used - 1, resetAt };
}
