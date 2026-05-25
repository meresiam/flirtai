import { describe, expect, it } from "vitest";

import { COACH_TOOL_NAME, coachToolSchema } from "./coach-schema";
import type { CoachChatResponse } from "@/types/flirt";

describe("coachToolSchema (contract)", () => {
  it("exposes the canonical tool name expected by /api/coach", () => {
    expect(COACH_TOOL_NAME).toBe("submit_flirt_response");
    expect(coachToolSchema.name).toBe(COACH_TOOL_NAME);
  });

  it("requires the 4 top-level blocks consumed by the route", () => {
    const schema = coachToolSchema.input_schema;
    expect(schema.type).toBe("object");
    expect(schema.required).toEqual([
      "assistantMessage",
      "suggestions",
      "insight",
      "contact",
    ]);
  });

  it("uses the snake_case 'hot_lead' literal in the status enum (Wave 0 / C9)", () => {
    const properties = coachToolSchema.input_schema.properties as Record<
      string,
      { properties: Record<string, { enum?: string[] }> }
    >;
    const statusEnum = properties.contact.properties.status.enum;
    expect(statusEnum).toEqual(["active", "cold", "hot_lead"]);
    expect(statusEnum).not.toContain("hot lead");
  });

  it("enforces 3-5 suggestions with required tone/text/why + risk + likelyResponse (W2/M2)", () => {
    const properties = coachToolSchema.input_schema.properties as Record<
      string,
      {
        minItems?: number;
        maxItems?: number;
        items?: {
          required?: string[];
          properties?: Record<string, { enum?: string[]; type?: string }>;
        };
      }
    >;
    const suggestions = properties.suggestions;
    expect(suggestions.minItems).toBe(3);
    expect(suggestions.maxItems).toBe(5);
    expect(suggestions.items?.required).toEqual([
      "tone",
      "text",
      "why",
      "risk",
      "likelyResponse",
    ]);
    expect(suggestions.items?.properties?.risk?.enum).toEqual([
      "Safe",
      "Risky",
      "High-risk",
    ]);
    expect(suggestions.items?.properties?.likelyResponse?.type).toBe("string");
  });

  it("insight enforces the 4 required fields used by the shell UI", () => {
    const properties = coachToolSchema.input_schema.properties as Record<
      string,
      { required?: string[] }
    >;
    expect(properties.insight.required).toEqual([
      "interestLevel",
      "read",
      "move",
      "avoid",
    ]);
  });

  it("contact block requires only os campos minimos (W2/M3 — personalityType/interests/tags ficam optional)", () => {
    const properties = coachToolSchema.input_schema.properties as Record<
      string,
      { required?: string[]; properties?: Record<string, unknown> }
    >;
    expect(properties.contact.required).toEqual([
      "name",
      "source",
      "status",
      "attractionLevel",
      "lastInteractionSummary",
    ]);
    // Os 3 campos opcionais continuam declarados (LLM pode emitir, route faz merge).
    expect(properties.contact.properties?.personalityType).toBeDefined();
    expect(properties.contact.properties?.interests).toBeDefined();
    expect(properties.contact.properties?.tags).toBeDefined();
  });

  it("a synthetic LLM payload matches the CoachChatResponse TS shape", () => {
    const synthetic: CoachChatResponse = {
      assistantMessage: "Boa, manda essa.",
      suggestions: [
        {
          tone: "playful",
          text: "oi",
          why: "leve",
          risk: "Safe",
          likelyResponse: "ela responde com emoji",
        },
        {
          tone: "confident",
          text: "te chamei pra sair",
          why: "direto",
          risk: "Risky",
          likelyResponse: "ela topa ou pede pra esperar",
        },
        {
          tone: "intriguing",
          text: "tenho uma teoria sobre você",
          why: "puxa curiosidade",
          risk: "High-risk",
          likelyResponse: "ela engaja forte ou ignora",
        },
      ],
      insight: {
        interestLevel: "Medium",
        read: "ela respondeu rápido",
        move: "puxa encontro casual",
        avoid: "não overexplain",
      },
      contact: {
        name: "Bia",
        source: "Instagram",
        status: "hot_lead",
        attractionLevel: "High",
        lastInteractionSummary: "topou marcar terça",
      },
    };

    expect(synthetic.contact.status).toBe("hot_lead");
    expect(synthetic.suggestions.length).toBeGreaterThanOrEqual(3);
    expect(synthetic.suggestions.length).toBeLessThanOrEqual(5);
    // M3 — campos opcionais nao precisam estar presentes no payload
    expect(synthetic.contact.personalityType).toBeUndefined();
    expect(synthetic.contact.interests).toBeUndefined();
    expect(synthetic.contact.tags).toBeUndefined();
    // M2 — todo suggestion carrega risk + likelyResponse
    for (const s of synthetic.suggestions) {
      expect(s.risk).toBeDefined();
      expect(s.likelyResponse).toBeDefined();
    }
  });
});
