// Gera ProfileReport via Gemini structured output.
// Recebe contexto já calculado (deltas, posts novos, posts deletados) e pede ao
// LLM apenas a camada de linguagem natural (aiSummary + aiHighlights).

import {
  createGeminiClient,
  generateStructured,
  resolveGeminiModel,
} from "@/lib/llm/gemini";

import type { ProfileSource } from "./types";
import type { ReportHighlight } from "./types";
import { reportResponseSchema } from "./tools/report-tool-schema";

export interface ReportContext {
  handle: string;
  displayName: string | null;
  source: ProfileSource;
  windowStart: Date;
  windowEnd: Date;
  followersBefore: number;
  followersAfter: number;
  followersDelta: number;
  newPostsCount: number;
  deletedPostsCount: number;
  engagementAvg: number | null;
  newPostsSummary: string[];   // ex.: "Reel 02-06: 'Treino full body' — 1.2k likes"
  deletedPostsSummary: string[]; // ex.: "Post deletado: 'Viagem RJ' (visto até 01-06)"
}

const SYSTEM_PROMPT = `Você é um analista de presença pública em Instagram. Receberá métricas agregadas de um perfil PÚBLICO e deve produzir um resumo PT-BR curto e factual.

REGRAS NÃO-NEGOCIÁVEIS:
- Use apenas os dados públicos fornecidos. NÃO infira vida pessoal, status afetivo, orientação, ou estado emocional do dono do perfil.
- Foco em padrões observáveis: cadência, formato dominante, engajamento relativo, mudanças de bio/avatar/categoria.
- Quando houver post deletado, descreva como "post deletado" sem especular o porquê.
- Tom: factual, profissional. Sem floreio.
- Resposta SEMPRE no schema JSON pedido.`;

export async function generateReport(ctx: ReportContext): Promise<{
  aiSummary: string;
  aiHighlights: ReportHighlight[];
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY ausente.");

  const model = resolveGeminiModel();
  const client = createGeminiClient(apiKey);

  const userMessage = [
    `Perfil monitorado (tipo: ${ctx.source}): @${ctx.handle}${ctx.displayName ? ` (${ctx.displayName})` : ""}.`,
    `Janela: ${ctx.windowStart.toISOString()} → ${ctx.windowEnd.toISOString()}.`,
    "",
    `Seguidores: ${ctx.followersBefore} → ${ctx.followersAfter} (Δ ${ctx.followersDelta >= 0 ? "+" : ""}${ctx.followersDelta}).`,
    `Posts novos: ${ctx.newPostsCount}.`,
    `Posts deletados desde último scan: ${ctx.deletedPostsCount}.`,
    `Engajamento médio do período: ${ctx.engagementAvg !== null ? ctx.engagementAvg.toFixed(4) : "—"}.`,
    "",
    ctx.newPostsSummary.length
      ? `Novos posts:\n- ${ctx.newPostsSummary.join("\n- ")}`
      : "Sem posts novos.",
    "",
    ctx.deletedPostsSummary.length
      ? `Posts deletados:\n- ${ctx.deletedPostsSummary.join("\n- ")}`
      : "Sem deleções detectadas.",
  ].join("\n");

  let input: { aiSummary: string; aiHighlights: ReportHighlight[] };
  try {
    const { data } = await generateStructured<{
      aiSummary: string;
      aiHighlights: ReportHighlight[];
    }>({
      client,
      model,
      system: SYSTEM_PROMPT,
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      schema: reportResponseSchema,
      maxOutputTokens: 1024,
    });
    input = data;
  } catch (err) {
    throw new Error(
      `Gemini falhou ao gerar report: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return {
    aiSummary: input.aiSummary,
    aiHighlights: input.aiHighlights ?? [],
  };
}
