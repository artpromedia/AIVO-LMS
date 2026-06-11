import { describe, it, expect } from "vitest";
import {
  defineTutor,
  validateTutorDefinition,
  assertValidTutorDefinition,
  isBandProductionReady,
  getProductionGradeBands,
  getCoverageStatus,
  type TutorDefinition, NO_MEMORY, standardActionPolicy } from "../index.js";

const valid: TutorDefinition = defineTutor({
  id: "speech-buddy@1.0.0",
  schemaVersion: 1,
  persona: {
    id: "speech-buddy",
    name: "Buddy",
    tagline: "Practice talking with a friend.",
    voiceStyle: "warm",
    locale: "en-US",
  },
  capabilities: ["chat", "voice_in", "voice_out"],
  subjects: ["speech"],
  gradeBands: ["PRE_K", "K", "1", "2"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL"],
  skillGraphRefs: ["speech.articulation.k2"],
  defaultContentPackRefs: ["speech-buddy-pack-1"],
  // Wave E (S8): required agent-policy fields.
  toolset: ["get_learner_snapshot"],
  actionPolicy: standardActionPolicy(),
  memoryPolicy: NO_MEMORY,
  policy: {
    requiresConsent: true,
    minAgeYears: 3,
    maxSessionMinutes: 15,
    requirePiiScrubbing: true,
  },
});

describe("validateTutorDefinition", () => {
  it("returns no issues for a well-formed tutor", () => {
    expect(validateTutorDefinition(valid)).toEqual([]);
  });

  it("flags wrong schemaVersion", () => {
    const issues = validateTutorDefinition({ ...valid, schemaVersion: 2 as any });
    expect(issues.find((i) => i.code === "unsupported_schema_version")).toBeDefined();
  });

  it("flags an id without a semver tail", () => {
    const issues = validateTutorDefinition({ ...valid, id: "speech-buddy" });
    expect(issues.find((i) => i.code === "invalid_id")).toBeDefined();
  });

  it("flags missing required fields", () => {
    const issues = validateTutorDefinition({
      ...valid,
      subjects: [],
      gradeBands: [],
      functioningLevels: [],
      skillGraphRefs: [],
    });
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("empty_subjects");
    expect(codes).toContain("empty_grade_bands");
    expect(codes).toContain("empty_functioning_levels");
    expect(codes).toContain("empty_skill_graph_refs");
  });

  it("flags duplicate capabilities", () => {
    const issues = validateTutorDefinition({
      ...valid,
      capabilities: ["chat", "chat", "voice_in", "voice_out"],
    });
    expect(issues.find((i) => i.code === "duplicate_capability")).toBeDefined();
  });

  it("flags voice tutors without consent gating", () => {
    const issues = validateTutorDefinition({
      ...valid,
      policy: { ...valid.policy, requiresConsent: false },
    });
    expect(issues.find((i) => i.code === "policy_consent_required_for_voice")).toBeDefined();
  });

  it("does not flag consent for non-voice tutors", () => {
    const def: TutorDefinition = {
      ...valid,
      capabilities: ["chat"],
      policy: { ...valid.policy, requiresConsent: false },
    };
    const issues = validateTutorDefinition(def);
    expect(issues.find((i) => i.code === "policy_consent_required_for_voice")).toBeUndefined();
  });
});

describe("coverageMatrix validation", () => {
  it("accepts a well-formed matrix whose keys are all declared bands", () => {
    const def: TutorDefinition = {
      ...valid,
      coverageMatrix: { PRE_K: "scaffold", K: "authored", "1": "authored", "2": "scaffold" },
    };
    expect(validateTutorDefinition(def)).toEqual([]);
  });

  it("flags a matrix key that is not declared in gradeBands", () => {
    const def: TutorDefinition = {
      ...valid,
      coverageMatrix: { K: "authored", "9": "missing" },
    };
    const issues = validateTutorDefinition(def);
    expect(issues.find((i) => i.code === "coverage_matrix_grade_not_declared")).toBeDefined();
  });

  it("flags an invalid status value", () => {
    const def: TutorDefinition = {
      ...valid,
      coverageMatrix: { K: "todo" as any },
    };
    const issues = validateTutorDefinition(def);
    expect(issues.find((i) => i.code === "coverage_matrix_invalid_status")).toBeDefined();
  });
});

describe("assertValidTutorDefinition", () => {
  it("does not throw on a valid def", () => {
    expect(() => assertValidTutorDefinition(valid)).not.toThrow();
  });
  it("throws with a multi-issue summary on invalid def", () => {
    expect(() => assertValidTutorDefinition({ ...valid, id: "x", subjects: [] })).toThrow(
      /invalid_id|empty_subjects/,
    );
  });
});

describe("defineTutor", () => {
  it("returns the input verbatim (identity at runtime)", () => {
    const out = defineTutor(valid);
    expect(out).toBe(valid);
  });
});

describe("coverage helpers", () => {
  const withMatrix: TutorDefinition = {
    ...valid,
    coverageMatrix: { PRE_K: "scaffold", K: "authored", "1": "authored", "2": "missing" },
  };

  it("isBandProductionReady returns true only for authored bands", () => {
    expect(isBandProductionReady(withMatrix, "K")).toBe(true);
    expect(isBandProductionReady(withMatrix, "1")).toBe(true);
    expect(isBandProductionReady(withMatrix, "PRE_K")).toBe(false);
    expect(isBandProductionReady(withMatrix, "2")).toBe(false);
  });

  it("isBandProductionReady returns false for bands outside gradeBands", () => {
    expect(isBandProductionReady(withMatrix, "9")).toBe(false);
  });

  it("isBandProductionReady is permissive when coverageMatrix is omitted", () => {
    expect(isBandProductionReady(valid, "K")).toBe(true);
    expect(isBandProductionReady(valid, "9")).toBe(false);
  });

  it("getProductionGradeBands returns only authored bands", () => {
    expect(getProductionGradeBands(withMatrix)).toEqual(["K", "1"]);
  });

  it("getCoverageStatus returns the matrix value or undefined", () => {
    expect(getCoverageStatus(withMatrix, "K")).toBe("authored");
    expect(getCoverageStatus(withMatrix, "2")).toBe("missing");
    expect(getCoverageStatus(valid, "K")).toBeUndefined();
  });
});

// ── Wave E (S8): agent-policy validation ────────────────────────────────────

describe("agent policy validation (Wave E)", () => {
  it("flags a declared functioning level the actionPolicy does not cover", () => {
    const issues = validateTutorDefinition({
      ...valid,
      functioningLevels: ["STANDARD", "PRE_SYMBOLIC"],
      actionPolicy: { STANDARD: ["advance", "say"] },
    });
    expect(issues.some((i) => i.code === "action_policy_missing_level")).toBe(true);
  });

  it("flags free-text say at LOW_VERBAL and below", () => {
    const issues = validateTutorDefinition({
      ...valid,
      functioningLevels: ["STANDARD", "LOW_VERBAL"],
      actionPolicy: {
        STANDARD: ["advance", "say"],
        LOW_VERBAL: ["advance", "say"],
      },
    });
    expect(issues.some((i) => i.code === "action_policy_say_below_floor")).toBe(true);
  });

  it("flags unknown tools and unknown actions", () => {
    const issues = validateTutorDefinition({
      ...valid,
      toolset: ["get_learner_snapshot", "rm_rf" as never],
      actionPolicy: standardActionPolicy({ STANDARD: ["advance", "teleport" as never] }),
    });
    expect(issues.some((i) => i.code === "toolset_unknown_tool")).toBe(true);
    expect(issues.some((i) => i.code === "action_policy_unknown_action")).toBe(true);
  });

  it("flags an inconsistent memory policy", () => {
    const issues = validateTutorDefinition({
      ...valid,
      memoryPolicy: { canRemember: true, kinds: [] },
    });
    expect(issues.some((i) => i.code === "memory_policy_inconsistent")).toBe(true);
  });

  it("the standard policy itself validates clean on every level", () => {
    const issues = validateTutorDefinition({
      ...valid,
      functioningLevels: [
        "STANDARD",
        "SUPPORTED",
        "LOW_VERBAL",
        "NON_VERBAL",
        "PRE_SYMBOLIC",
      ],
      actionPolicy: standardActionPolicy(),
    });
    expect(issues).toEqual([]);
  });
});
