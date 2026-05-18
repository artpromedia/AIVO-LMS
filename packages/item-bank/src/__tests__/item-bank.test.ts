import { describe, it, expect } from "vitest";
import {
  pickVariant,
  registerDefect,
  retireVariant,
  validateItemVariant,
  type Item,
  type ItemBank,
  type ItemVariant,
} from "../index.js";

const variant = (
  id: string,
  weight: number,
  status: ItemVariant["status"] = "active",
): ItemVariant => ({
  id,
  itemId: "count-3",
  version: "1.0.0",
  status,
  cohortWeight: weight,
  publishedAt: "2026-04-01T00:00:00Z",
  body: { stem: "How many?" },
  defectCount: 0,
});

const item = (variants: ItemVariant[]): Item => ({
  id: "count-3",
  skillId: "ccss.math.k.cc.a.3",
  variants,
});

const bank = (items: Item[], defectBudget = 3): ItemBank => ({
  id: "k-math-fall-2026",
  schemaVersion: 1,
  items,
  defectBudget,
});

describe("pickVariant", () => {
  it("returns null when no eligible variants exist", () => {
    expect(pickVariant(item([]), "l-1")).toBeNull();
    expect(pickVariant(item([variant("v1", 1, "retired")]), "l-1")).toBeNull();
    expect(pickVariant(item([variant("v1", 0)]), "l-1")).toBeNull();
  });

  it("returns the only eligible variant", () => {
    const v = variant("v1", 1);
    expect(pickVariant(item([v]), "l-1")).toBe(v);
  });

  it("is deterministic per (learner, item)", () => {
    const it = item([variant("v1", 1), variant("v2", 1), variant("v3", 1)]);
    const a = pickVariant(it, "learner-A");
    const b = pickVariant(it, "learner-A");
    expect(a?.id).toBe(b?.id);
  });

  it("excludes retired variants from routing", () => {
    const it = item([variant("v1", 1, "retired"), variant("v2", 1)]);
    for (let i = 0; i < 50; i++) {
      const v = pickVariant(it, `learner-${i}`);
      expect(v?.id).toBe("v2");
    }
  });

  it("respects cohort weights — heavy variant gets ~ proportional traffic", () => {
    const it = item([variant("v1", 0.9), variant("v2", 0.1)]);
    let v1 = 0;
    let v2 = 0;
    for (let i = 0; i < 1000; i++) {
      const v = pickVariant(it, `learner-${i}`);
      if (v?.id === "v1") v1++;
      else if (v?.id === "v2") v2++;
    }
    // 90/10 split — allow 5pp slack.
    expect(v1 / 1000).toBeGreaterThan(0.85);
    expect(v1 / 1000).toBeLessThan(0.95);
  });
});

describe("registerDefect", () => {
  it("increments defectCount and auto-retires at budget", () => {
    const b = bank([item([variant("v1", 1)])], 3);
    const defect = (n: number) => ({
      variantId: "v1",
      category: "ambiguous_stem" as const,
      detail: `defect ${n}`,
      reportedAt: new Date().toISOString(),
    });
    const v1 = registerDefect(b, defect(1));
    expect(v1?.defectCount).toBe(1);
    expect(v1?.status).toBe("active");
    registerDefect(b, defect(2));
    const v3 = registerDefect(b, defect(3));
    expect(v3?.defectCount).toBe(3);
    expect(v3?.status).toBe("retired");
  });

  it("returns null when the variant id is unknown", () => {
    const b = bank([item([variant("v1", 1)])]);
    expect(
      registerDefect(b, {
        variantId: "ghost",
        category: "other",
        detail: "n/a",
        reportedAt: new Date().toISOString(),
      }),
    ).toBeNull();
  });
});

describe("retireVariant", () => {
  it("marks the variant retired and routes traffic away", () => {
    const it = item([variant("v1", 1), variant("v2", 1)]);
    const b = bank([it]);
    retireVariant(b, "v1");
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(pickVariant(it, `l-${i}`)?.id ?? "");
    expect(seen.has("v1")).toBe(false);
    expect(seen.has("v2")).toBe(true);
  });
});

describe("validateItemVariant", () => {
  it("accepts a well-formed variant", () => {
    expect(validateItemVariant(variant("v1", 1))).toEqual([]);
  });
  it("flags invalid version, weight, missing fields", () => {
    const broken: ItemVariant = {
      id: "",
      itemId: "",
      version: "1",
      status: "active",
      cohortWeight: 1.5,
      publishedAt: "",
      body: {},
      defectCount: 0,
    };
    const codes = validateItemVariant(broken).map((i) => i.code);
    expect(codes).toContain("missing_id");
    expect(codes).toContain("missing_item_id");
    expect(codes).toContain("invalid_version");
    expect(codes).toContain("invalid_cohort_weight");
    expect(codes).toContain("missing_published_at");
    expect(codes).toContain("empty_body");
  });
});
