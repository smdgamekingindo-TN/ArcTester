import { describe, expect, it } from "vitest";
import {
  AP_ECET_2026_BLUEPRINT_TOTAL,
  AP_ECET_2026_CSE_BLUEPRINT,
  countBlueprintQuestions,
} from "./apEcetBlueprint";

describe("AP ECET 2026 CSE blueprint", () => {
  it("contains the three common subjects and all thirteen CSE units", () => {
    expect(AP_ECET_2026_CSE_BLUEPRINT.filter((subject) => subject.section === "Common")).toHaveLength(3);
    expect(AP_ECET_2026_CSE_BLUEPRINT.filter((subject) => subject.section === "CSE")).toHaveLength(13);
    expect(AP_ECET_2026_BLUEPRINT_TOTAL).toBe(200);
  });

  it("aggregates only catalog entries matching a blueprint alias", () => {
    expect(countBlueprintQuestions([
      { name: "Maths", count: 7 },
      { name: "Mathematics", count: 5 },
      { name: "Unrelated subject", count: 99 },
    ], ["Mathematics", "Maths"])).toBe(12);
  });
});
