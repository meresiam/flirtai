import type Anthropic from "@anthropic-ai/sdk";

export const COACH_TOOL_NAME = "submit_flirt_response";

export const coachToolSchema: Anthropic.Tool = {
  name: COACH_TOOL_NAME,
  description: "Submit the structured FLIRT A.I coaching response to the user.",
  input_schema: {
    type: "object",
    required: ["assistantMessage", "suggestions", "insight", "contact"],
    properties: {
      assistantMessage: {
        type: "string",
        description: "Natural chat-bubble message. PT-BR. Short paragraphs.",
      },
      suggestions: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          required: ["tone", "text", "why", "risk", "likelyResponse"],
          properties: {
            tone: {
              type: "string",
              enum: ["playful", "confident", "intriguing", "direct"],
            },
            text: { type: "string" },
            why: { type: "string" },
            risk: {
              type: "string",
              enum: ["Safe", "Risky", "High-risk"],
              description:
                "Safe = aposta baixa, baixa rejeição. Risky = aposta média, polariza. High-risk = aposta alta, ou ganha forte ou queima.",
            },
            likelyResponse: {
              type: "string",
              description:
                "Como ela provavelmente responde a essa mensagem, em 1 frase curta PT-BR.",
            },
          },
        },
      },
      insight: {
        type: "object",
        required: ["interestLevel", "read", "move", "avoid"],
        properties: {
          interestLevel: { type: "string", enum: ["Low", "Medium", "High"] },
          read: { type: "string" },
          move: { type: "string" },
          avoid: { type: "string" },
        },
      },
      contact: {
        type: "object",
        required: [
          "name",
          "source",
          "status",
          "attractionLevel",
          "lastInteractionSummary",
        ],
        properties: {
          name: { type: "string" },
          source: { type: "string" },
          status: {
            type: "string",
            enum: ["active", "cold", "hot_lead"],
          },
          attractionLevel: {
            type: "string",
            enum: ["Low", "Medium", "High"],
          },
          personalityType: { type: "string" },
          interests: {
            type: "array",
            maxItems: 6,
            items: { type: "string" },
          },
          tags: {
            type: "array",
            maxItems: 4,
            items: { type: "string" },
          },
          lastInteractionSummary: { type: "string" },
        },
      },
    },
  },
};
