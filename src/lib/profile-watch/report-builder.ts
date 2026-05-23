// Gera ProfileReport via Anthropic tool_use.
// Recebe contexto já calculado (deltas, posts novos, posts deletados) e pede ao
// LLM apenas a camada de linguagem natural (aiSummary + aiHighlights).

import Anthropic from "@anthropic-ai/sdk";

import type { ProfileSource } from "./types";
import type { ReportHighlight } from "./types";
import { REPORT_TOOL_NAME, reportToolSchema } from "./tools/report-tool-schema";

const DEFAULT_MODEL = "claude-sonnet-4-6";

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
- Resposta SEMPRE via tool submit_profile_report.`;

export async function generateReport(ctx: ReportContext): Promise<{
  aiSummary: string;
  aiHighlights: ReportHighlight[];
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY ausente.");

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });

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

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      tools: [reportToolSchema],
      tool_choice: { type: "tool", name: REPORT_TOOL_NAME },
    });
  } catch (err) {
    throw new Error(
      `Anthropic falhou ao gerar report: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const toolBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolBlock) throw new Error("Anthropic response sem tool_use block.");

  const input = toolBlock.input as {
    aiSummary: string;
    aiHighlights: ReportHighlight[];
  };

  return {
    aiSummary: input.aiSummary,
    aiHighlights: input.aiHighlights ?? [],
  };
}
