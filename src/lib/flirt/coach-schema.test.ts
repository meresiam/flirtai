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

  it("enforces 3-5 suggestions with required tone/text/why", () => {
    const properties = coachToolSchema.input_schema.properties as Record<
      string,
      { minItems?: number; maxItems?: number; items?: { required?: string[] } }
    >;
    const suggestions = properties.suggestions;
    expect(suggestions.minItems).toBe(3);
    expect(suggestions.maxItems).toBe(5);
    expect(suggestions.items?.required).toEqual(["tone", "text", "why"]);
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

  it("contact block requires the fields the route persists in $transaction", () => {
    const properties = coachToolSchema.input_schema.properties as Record<
      string,
      { required?: string[] }
    >;
    expect(properties.contact.required).toEqual([
      "name",
      "source",
      "status",
      "attractionLevel",
      "personalityType",
      "interests",
      "tags",
      "lastInteractionSummary",
    ]);
  });

  it("a synthetic LLM payload matches the CoachChatResponse TS shape", () => {
    const synthetic: CoachChatResponse = {
      assistantMessage: "Boa, manda essa.",
      suggestions: [
        { tone: "playful", text: "oi", why: "leve" },
        { tone: "confident", text: "te chamei pra sair", why: "direto" },
        { tone: "intriguing", text: "tenho uma teoria sobre você", why: "puxa curiosidade" },
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
        personalityType: "intelectual irreverente",
        interests: ["livro", "café"],
        tags: ["potencial alto"],
        lastInteractionSummary: "topou marcar terça",
      },
    };

    expect(synthetic.contact.status).toBe("hot_lead");
    expect(synthetic.suggestions.length).toBeGreaterThanOrEqual(3);
    expect(synthetic.suggestions.length).toBeLessThanOrEqual(5);
  });
});
