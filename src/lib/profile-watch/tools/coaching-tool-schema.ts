// Anthropic tool schema pra gerar CoachingSuggestion[] em perfil SELF.
// Usado pela Wave 4 (Self-Coach). MVP mantém o schema pronto.

import type Anthropic from "@anthropic-ai/sdk";

export const COACHING_TOOL_NAME = "submit_coaching_suggestions";

export const coachingToolSchema: Anthropic.Tool = {
  name: COACHING_TOOL_NAME,
  description:
    "Submit structured improvement suggestions for the user's OWN Instagram profile. PT-BR. Actionable, concrete, no personality judgement.",
  input_schema: {
    type: "object",
    required: ["suggestions"],
    properties: {
      suggestions: {
        type: "array",
        minItems: 1,
        maxItems: 8,
        items: {
          type: "object",
          required: ["dimension", "severity", "title", "description", "actionItems"],
          properties: {
            dimension: {
              type: "string",
              enum: ["bio", "grid", "cadence", "pillars", "engagement"],
            },
            severity: {
              type: "string",
              enum: ["info", "suggestion", "critical"],
            },
            title: { type: "string" },
            description: { type: "string" },
            actionItems: {
              type: "array",
              minItems: 1,
              maxItems: 5,
              items: { type: "string" },
            },
          },
        },
      },
    },
  },
};
