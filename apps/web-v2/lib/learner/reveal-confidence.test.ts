/**
 * Sprint C-14 — confidence-derivation rule (screen 3).
 *
 * Pins every branch of the documented rule so the 3-level dot the parent sees
 * never drifts from the threshold in code, and proves the no-source case
 * returns null (a chip/dot is never rendered without backing data — DoD #2).
 */
import { describe, expect, it } from "vitest";
import {
  BASELINE_HIGH_CONFIDENCE_MIN,
  deriveConfidence,
  parseDecisionSource,
  type RevealSource,
} from "./reveal-confidence";

const parent: RevealSource = { kind: "parent", role: null };
const baseline: RevealSource = { kind: "baseline", role: null };
const therapist: RevealSource = { kind: "collaborator", role: "therapist" };
const teacher: RevealSource = { kind: "collaborator", role: "teacher" };

describe("deriveConfidence", () => {
  it("returns null when there is no source at all (no chip, no dot)", () => {
    expect(deriveConfidence({ sources: [], baselineAnswered: 0 })).toBeNull();
    expect(deriveConfidence({ sources: [], baselineAnswered: 50 })).toBeNull();
  });

  it("is HIGH when two independent sources agree", () => {
    expect(deriveConfidence({ sources: [parent, teacher], baselineAnswered: 0 })).toBe("high");
    expect(deriveConfidence({ sources: [parent, baseline], baselineAnswered: 3 })).toBe("high");
    // Two distinct collaborator roles are two independent voices.
    expect(deriveConfidence({ sources: [teacher, therapist], baselineAnswered: 0 })).toBe("high");
  });

  it("is HIGH for a single baseline signal at/above the documented threshold", () => {
    expect(
      deriveConfidence({ sources: [baseline], baselineAnswered: BASELINE_HIGH_CONFIDENCE_MIN }),
    ).toBe("high");
    expect(deriveConfidence({ sources: [baseline], baselineAnswered: 40 })).toBe("high");
  });

  it("is MEDIUM for a single source with baseline support", () => {
    // Single baseline source below the high threshold → medium.
    expect(deriveConfidence({ sources: [baseline], baselineAnswered: 5 })).toBe("medium");
    // Single parent source, but baseline data exists alongside → medium.
    expect(deriveConfidence({ sources: [parent], baselineAnswered: 8 })).toBe("medium");
    expect(deriveConfidence({ sources: [therapist], baselineAnswered: 4 })).toBe("medium");
  });

  it("is LOW for a single source with no baseline support (early signal)", () => {
    expect(deriveConfidence({ sources: [parent], baselineAnswered: 0 })).toBe("low");
    expect(deriveConfidence({ sources: [therapist], baselineAnswered: 0 })).toBe("low");
  });

  it("does not double-count the same voice toward the ≥2 rule", () => {
    // Two parent entries are one voice → not high.
    expect(deriveConfidence({ sources: [parent, parent], baselineAnswered: 0 })).toBe("low");
    // Two therapist entries (same role) are one voice → not high.
    expect(
      deriveConfidence({ sources: [therapist, therapist], baselineAnswered: 0 }),
    ).toBe("low");
  });
});

describe("parseDecisionSource", () => {
  it("parses a collaborator source with its role", () => {
    expect(parseDecisionSource("collaborator:therapist")).toEqual({
      kind: "collaborator",
      role: "therapist",
    });
    expect(parseDecisionSource("collaborator:teacher")).toEqual({
      kind: "collaborator",
      role: "teacher",
    });
  });

  it("parses baseline / iep / parent origins", () => {
    expect(parseDecisionSource("discovery_adventure")).toEqual({ kind: "baseline", role: null });
    expect(parseDecisionSource("iep")).toEqual({ kind: "iep", role: null });
    expect(parseDecisionSource("parent_modification")).toEqual({ kind: "parent", role: null });
  });

  it("returns null for template / functioning-level defaults (not a parent voice)", () => {
    expect(parseDecisionSource("functioning_level_template")).toBeNull();
    expect(parseDecisionSource("template_default")).toBeNull();
    expect(parseDecisionSource("")).toBeNull();
    expect(parseDecisionSource(null)).toBeNull();
    expect(parseDecisionSource(undefined)).toBeNull();
  });
});
