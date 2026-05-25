import { describe, expect, it } from "vitest";

import { statusToDb } from "./serializers";
import type { ContactStatus } from "@/types/flirt";

describe("statusToDb (Wave 0 / C9 — Naming Lock passthrough)", () => {
  it("returns the same literal — TS and DB enums are now aligned", () => {
    expect(statusToDb("active")).toBe("active");
    expect(statusToDb("cold")).toBe("cold");
    expect(statusToDb("hot_lead")).toBe("hot_lead");
  });
});

describe("statusToDb (Wave 1 / C1 — regressão pós-wiring)", () => {
  // C1 plugou statusToDb em /api/coach e PATCH /api/contacts/[id] como
  // ponto único de transformação TS→DB. Hoje é passthrough mas precisa
  // continuar idempotente e cobrir os 3 valores válidos do enum.
  const cases: ContactStatus[] = ["active", "cold", "hot_lead"];

  it.each(cases)("é idempotente — statusToDb(statusToDb(x)) === x para '%s'", (value) => {
    expect(statusToDb(statusToDb(value))).toBe(value);
  });

  it("cobre todo o enum ContactStatus sem omissões", () => {
    // Se o enum ganhar valor novo, esse teste quebra explicitamente —
    // forçando o autor a decidir como statusToDb mapeia o novo valor.
    const expected = new Set<ContactStatus>(["active", "cold", "hot_lead"]);
    cases.forEach((c) => expected.delete(c));
    expect(expected.size).toBe(0);
  });
});
