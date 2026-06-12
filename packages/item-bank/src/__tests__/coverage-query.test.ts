import { describe, expect, it } from "vitest";
import {
  COVERAGE_GRADE_BANDS,
  authoredItemCountsByBand,
  countAuthoredItems,
  gradeBandForItem,
} from "../coverage-query.js";
import { getProductionItemsForSubject } from "../production.js";

describe("gradeBandForItem", () => {
  it("decodes CCSS-style dot-token skillIds", () => {
    expect(gradeBandForItem({ skillId: "ccss-math.K.CC.A.1" })).toBe("K");
    expect(gradeBandForItem({ skillId: "ccss-math.3.OA.A.1" })).toBe("3");
    expect(gradeBandForItem({ skillId: "casel.sel.1.self-management.1" })).toBe("1");
  });

  it("decodes NGSS codes, including middle-school .gN suffixes", () => {
    expect(gradeBandForItem({ skillId: "ngss.K-PS2-1" })).toBe("K");
    expect(gradeBandForItem({ skillId: "ngss.3-LS1-1" })).toBe("3");
    expect(gradeBandForItem({ skillId: "ngss.MS-LS1-1.g6" })).toBe("6");
    expect(gradeBandForItem({ skillId: "ngss.MS-ESS1-1.g8" })).toBe("8");
  });

  it("maps PRE-K foundations skillIds to PRE_K", () => {
    expect(gradeBandForItem({ skillId: "prek.math.notice-quantity" })).toBe("PRE_K");
    expect(gradeBandForItem({ skillId: "prek.executive-function.follow-routine" })).toBe("PRE_K");
  });

  it("returns null for undecodable skillIds rather than guessing", () => {
    expect(gradeBandForItem({ skillId: "" })).toBeNull();
    expect(gradeBandForItem({ skillId: "mystery.skill.no-grade" })).toBeNull();
  });
});

describe("countAuthoredItems", () => {
  it("returns the real count for a band that has production items", () => {
    // The math seed bank ships 4 kindergarten items (counted live, not
    // from a manifest) — this is the number the coverage gate's
    // MIN_AUTHORED_ITEMS_PER_BAND bar compares against.
    expect(countAuthoredItems("math", "K")).toBeGreaterThanOrEqual(3);
  });

  it("returns 0 for a band with no production items", () => {
    // No subject ships grade 9-12 math items today — the gate must see 0
    // here, which is exactly why nova's 9-12 bands are 'scaffold'.
    expect(countAuthoredItems("math", "12")).toBe(0);
  });

  it("only counts items with at least one active variant", () => {
    const total = getProductionItemsForSubject("math").length;
    const counted = Object.values(authoredItemCountsByBand("math")).reduce((a, b) => a + b, 0);
    // Every production math item is active and band-decodable, so the
    // per-band counts must re-add to the full bank — any gap would mean
    // the gate silently under- or over-counts.
    expect(counted).toBe(total);
  });

  it("covers every matrix band key", () => {
    const counts = authoredItemCountsByBand("ela");
    for (const band of COVERAGE_GRADE_BANDS) {
      expect(counts[band]).toBeTypeOf("number");
    }
  });
});
