// Anthropic tool schema pra geração de ProfileReport.
// Espelha o padrão do coach (tool_use forçado, JSON estruturado).

import type Anthropic from "@anthropic-ai/sdk";

export const REPORT_TOOL_NAME = "submit_profile_report";

export const reportToolSchema: Anthropic.Tool = {
  name: REPORT_TOOL_NAME,
  description:
    "Submit the structured daily/window report for a monitored Instagram profile. PT-BR copy. No personal-life inference.",
  input_schema: {
    type: "object",
    required: ["aiSummary", "aiHighlights"],
    properties: {
      aiSummary: {
        type: "string",
        description:
          "Parágrafo curto em PT-BR (2-4 frases) com leitura do período. Foco em padrões públicos (cadência, formato, engajamento). NÃO inferir vida pessoal, status afetivo ou estado emocional.",
      },
      aiHighlights: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        items: {
          type: "object",
          required: ["type", "label", "value"],
          properties: {
            type: {
              type: "string",
              enum: ["growth", "engagement", "content", "delete", "anomaly"],
            },
            label: { type: "string", description: "Frase curta PT-BR." },
            value: {
              type: "string",
              description: "Métrica ou observação concreta. Ex: '+312 seguidores', '3 reels'.",
            },
          },
        },
      },
    },
  },
};
