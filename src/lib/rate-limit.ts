import { prisma } from "@/lib/db";

const DEFAULT_LIMIT_PER_HOUR = 60;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: Date;
  /** Id da linha de UsageLog criada — usado pra gravar tokens após a chamada LLM. */
  usageLogId: string | null;
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
    return { ok: false, remaining: 0, resetAt, usageLogId: null };
  }

  const entry = await prisma.usageLog.create({
    data: { userId, route },
    select: { id: true },
  });

  return { ok: true, remaining: limit - used - 1, resetAt, usageLogId: entry.id };
}

export interface LlmUsageRecord {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

/**
 * Grava tokens/modelo na linha de UsageLog criada pelo rate limit.
 * Falha silenciosa: perder telemetria nunca pode derrubar a resposta.
 */
export async function recordLlmUsage(
  usageLogId: string | null,
  usage: LlmUsageRecord,
): Promise<void> {
  if (!usageLogId) return;
  try {
    await prisma.usageLog.update({
      where: { id: usageLogId },
      data: usage,
    });
  } catch {
    // swallow — telemetria não é critical path
  }
}
