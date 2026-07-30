// JSON Schema pra gerar CoachingSuggestion[] em perfil SELF (responseJsonSchema
// do Gemini). Usado pela Wave 4 (Self-Coach). MVP mantém o schema pronto.

export const coachingResponseSchema: Record<string, unknown> = {
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
};
