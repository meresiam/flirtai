import { Langfuse } from "langfuse";

/**
 * Langfuse singleton (Wave 0 / C7).
 *
 * Graceful no-op se as env vars não estiverem setadas — permite que o app
 * rode em dev/preview sem Langfuse e ainda assim instrumente automaticamente
 * em produção/staging quando o provisionamento Coolify estiver pronto.
 *
 * Env vars esperadas:
 *  - LANGFUSE_PUBLIC_KEY   (pk_lf_...)
 *  - LANGFUSE_SECRET_KEY   (sk_lf_...)
 *  - LANGFUSE_BASE_URL     (https://langfuse.meresiam.com)
 */

let cached: Langfuse | null = null;

export function getLangfuse(): Langfuse | null {
  if (cached) return cached;

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL;

  if (!publicKey || !secretKey || !baseUrl) return null;

  cached = new Langfuse({
    publicKey,
    secretKey,
    baseUrl,
    flushAt: 1,
    flushInterval: 1_000,
  });

  return cached;
}

export type CoachTraceInput = {
  userIdHash: string;
  contactId: string;
  model: string;
  mode: "incoming" | "strategy";
};

export type CoachTraceOutput = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  latencyMs: number;
  status: "ok" | "error";
  errorMessage?: string;
};

/**
 * Log estruturado por call do coach. Sempre roda (independente do Langfuse),
 * gravando JSON em stdout pra ser agregado pelo Coolify/Vector/Loki depois.
 *
 * Em Langfuse: cria 1 trace + 1 generation block com tokens + latência.
 */
export async function traceCoachCall(
  input: CoachTraceInput,
  output: CoachTraceOutput,
): Promise<void> {
  // Log estruturado sempre — independente de Langfuse
  console.log(
    JSON.stringify({
      route: "/api/coach",
      ...input,
      ...output,
      at: new Date().toISOString(),
    }),
  );

  const lf = getLangfuse();
  if (!lf) return;

  const trace = lf.trace({
    name: "coach.call",
    userId: input.userIdHash,
    metadata: {
      contactId: input.contactId,
      mode: input.mode,
    },
  });

  trace.generation({
    name: "gemini.generateContent",
    model: input.model,
    usage: {
      input: output.inputTokens,
      output: output.outputTokens,
    },
    metadata: {
      cacheReadTokens: output.cacheReadTokens,
      cacheCreationTokens: output.cacheCreationTokens,
      latencyMs: output.latencyMs,
      status: output.status,
      errorMessage: output.errorMessage,
    },
  });

  // shutdown não bloqueia — usar flushAsync no fim do request handler
  await lf.flushAsync();
}

/** Hash leve do userId pra não vazar PII em logs. */
export function hashUserId(userId: string): string {
  // FNV-1a 32-bit — rápido, suficiente pra desambiguar em log sem ser reversível trivialmente
  let hash = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
