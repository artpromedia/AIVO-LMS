import { describe, expect, it } from "vitest";
import { applyRecommendation } from "../services/recommendation-effect-handlers.js";
import type { ProfileRecommendation } from "../services/types.js";

function makeRecommendation(overrides: Partial<ProfileRecommendation>): ProfileRecommendation {
  const now = new Date().toISOString();
  return {
    id: "rec-1",
    learnerId: "l1",
    type: "preferred_surface_change",
    title: "t",
    parentSummary: "s",
    currentValue: null,
    proposedValue: "scratchpad",
    confidence: 0.8,
    evidence: [],
    safety: {
      requiresParentApproval: true,
      affectsIEP: false,
      affectsInstructionalAccess: false,
      reversible: true,
    },
    status: "APPROVED",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("applyRecommendation", () => {
  it("adds an accommodation when approved", () => {
    const profile: Record<string, unknown> = {};
    const result = applyRecommendation(
      makeRecommendation({
        type: "accommodation_add",
        proposedValue: "extended_time",
      }),
      profile,
    );
    expect(result.status).toBe("APPLIED");
    expect(result.snapshot).toBeDefined();
    expect((profile as { activeAccommodations: string[] }).activeAccommodations).toContain(
      "extended_time",
    );
  });

  it("applies the amended value when present", () => {
    const profile: Record<string, unknown> = {};
    const result = applyRecommendation(
      makeRecommendation({
        type: "accommodation_add",
        proposedValue: "extended_time",
        amendedValue: "audio_enabled",
        status: "AMENDED",
      }),
      profile,
    );
    expect(result.status).toBe("APPLIED");
    expect((profile as { activeAccommodations: string[] }).activeAccommodations).toContain(
      "audio_enabled",
    );
    expect((profile as { activeAccommodations: string[] }).activeAccommodations).not.toContain(
      "extended_time",
    );
  });

  it("snapshots before/after Brain state", () => {
    const profile = { activeAccommodations: ["existing"] };
    const result = applyRecommendation(
      makeRecommendation({
        type: "accommodation_add",
        proposedValue: "extended_time",
      }),
      profile,
    );
    expect(result.snapshot?.before).toEqual({ activeAccommodations: ["existing"] });
    expect(
      (result.snapshot?.after as { activeAccommodations: string[] }).activeAccommodations,
    ).toContain("extended_time");
  });

  it("refuses to apply when recommendation is still PENDING", () => {
    const profile: Record<string, unknown> = {};
    const result = applyRecommendation(makeRecommendation({ status: "PENDING" }), profile);
    expect(result.status).toBe("FAILED");
  });

  it("does not mutate Brain for rebaseline_request", () => {
    const profile: Record<string, unknown> = { activeAccommodations: ["existing"] };
    const result = applyRecommendation(makeRecommendation({ type: "rebaseline_request" }), profile);
    expect(result.status).toBe("APPLIED");
    expect(profile).toEqual({ activeAccommodations: ["existing"] });
  });
});
