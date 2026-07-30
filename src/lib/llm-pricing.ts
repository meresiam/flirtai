// Preços em US$ por milhão de tokens. Gemini: ai.google.dev/gemini-api/docs/pricing
// (jul/2026). Claude fica na tabela pra precificar linhas HISTÓRICAS do
// UsageLog da era Anthropic. Cache read = 0.1x do input; cache write só
// existia na Anthropic (1.25x) — no Gemini cacheCreationTokens é sempre 0.
// Usado só pra ESTIMATIVA de gasto no /admin — não é fatura.

interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
}

const PRICING: Array<{ prefix: string; pricing: ModelPricing }> = [
  { prefix: "gemini-3.5-flash-lite", pricing: { inputPerMTok: 0.3, outputPerMTok: 2.5 } },
  { prefix: "gemini-3.1-flash-lite", pricing: { inputPerMTok: 0.25, outputPerMTok: 1.5 } },
  { prefix: "gemini-2.5-flash-lite", pricing: { inputPerMTok: 0.1, outputPerMTok: 0.4 } },
  { prefix: "claude-opus", pricing: { inputPerMTok: 5, outputPerMTok: 25 } },
  { prefix: "claude-sonnet", pricing: { inputPerMTok: 3, outputPerMTok: 15 } },
  { prefix: "claude-haiku", pricing: { inputPerMTok: 1, outputPerMTok: 5 } },
];

const DEFAULT_PRICING: ModelPricing = { inputPerMTok: 0.3, outputPerMTok: 2.5 };

function pricingFor(model: string | null): ModelPricing {
  if (!model) return DEFAULT_PRICING;
  const match = PRICING.find((entry) => model.startsWith(entry.prefix));
  return match?.pricing ?? DEFAULT_PRICING;
}

export interface TokenTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

/** Custo estimado em US$ de um agregado de tokens de um modelo. */
export function estimateCostUsd(model: string | null, totals: TokenTotals): number {
  const { inputPerMTok, outputPerMTok } = pricingFor(model);
  const cost =
    (totals.inputTokens * inputPerMTok +
      totals.outputTokens * outputPerMTok +
      totals.cacheReadTokens * inputPerMTok * 0.1 +
      totals.cacheCreationTokens * inputPerMTok * 1.25) /
    1_000_000;
  return cost;
}
