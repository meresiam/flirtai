// JSON Schema pra geração de ProfileReport (responseJsonSchema do Gemini).
// Espelha o padrão do coach (structured output forçado).

export const reportResponseSchema: Record<string, unknown> = {
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
};
