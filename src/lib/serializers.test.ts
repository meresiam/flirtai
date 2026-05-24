import { describe, expect, it } from "vitest";

import { statusToDb } from "./serializers";

describe("statusToDb (Wave 0 / C9 — Naming Lock passthrough)", () => {
  it("returns the same literal — TS and DB enums are now aligned", () => {
    expect(statusToDb("active")).toBe("active");
    expect(statusToDb("cold")).toBe("cold");
    expect(statusToDb("hot_lead")).toBe("hot_lead");
  });
});
