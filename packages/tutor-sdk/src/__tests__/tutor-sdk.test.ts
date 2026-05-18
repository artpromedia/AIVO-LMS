import { describe, it, expect } from "vitest";
import {
  defineTutor,
  validateTutorDefinition,
  assertValidTutorDefinition,
  type TutorDefinition,
} from "../index.js";

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
