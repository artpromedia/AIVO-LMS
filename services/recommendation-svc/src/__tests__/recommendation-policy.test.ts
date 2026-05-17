import { describe, expect, it } from "vitest";
import {
  RecommendationPolicyError,
  hasSufficientEvidence,
  isReadyToApply,
  requireMutationPermission,
  requireParentApproval,
} from "../services/recommendation-policy.js";

describe("recommendation policy", () => {
  it("allows parents to approve", () => {
    expect(() => requireParentApproval("parent")).not.toThrow();
  });

  it("rejects teacher approval", () => {
    expect(() => requireParentApproval("teacher")).toThrow(RecommendationPolicyError);
  });

  it("rejects district admin approval", () => {
    expect(() => requireParentApproval("district_admin")).toThrow(RecommendationPolicyError);
  });

  it("requires mutation role to mutate brain governance fields", () => {
    expect(() => requireMutationPermission("teacher")).toThrow(RecommendationPolicyError);
    expect(() => requireMutationPermission("parent")).not.toThrow();
    expect(() => requireMutationPermission("service")).not.toThrow();
  });

  it("treats two signals as sufficient evidence", () => {
    expect(
      hasSufficientEvidence([
        { source: "lesson", summary: "s1", metric: "m", value: 1 },
        { source: "lesson", summary: "s2", metric: "m", value: 1 },
      ]),
    ).toBe(true);
  });

  it("treats a high-confidence baseline as sufficient evidence", () => {
    expect(
      hasSufficientEvidence([{ source: "baseline", summary: "s1", metric: "m", value: 0.9 }]),
    ).toBe(true);
  });

  it("treats a single low-confidence signal as insufficient", () => {
    expect(
      hasSufficientEvidence([{ source: "lesson", summary: "s1", metric: "m", value: 0.2 }]),
    ).toBe(false);
  });

  it("treats APPROVED or AMENDED as ready to apply", () => {
    const base = {
      id: "r1",
      learnerId: "l1",
      type: "preferred_surface_change" as const,
      title: "t",
      parentSummary: "s",
      currentValue: null,
      proposedValue: "scratchpad",
      confidence: 0.8,
      evidence: [],
      safety: {
        requiresParentApproval: true as const,
        affectsIEP: false,
        affectsInstructionalAccess: false,
        reversible: true,
      },
      status: "APPROVED" as const,
      createdAt: "",
      updatedAt: "",
    };
    expect(isReadyToApply(base)).toBe(true);
    expect(isReadyToApply({ ...base, status: "AMENDED" })).toBe(true);
    expect(isReadyToApply({ ...base, status: "PENDING" })).toBe(false);
  });
});
