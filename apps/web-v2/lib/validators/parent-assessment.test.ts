import { describe, expect, it } from "vitest";
// Note: this import is intentionally relative (not aliased) so vitest can
// resolve it without a path-mapping config — the rest of apps/web-v2 uses
// `@/lib/...` aliases at runtime via Next's tsconfig.
import {
  ASSESSMENT_SECTION_ORDER,
  WIZARD_STEPS,
  assessmentSectionSchemas,
  validateSection,
  type AssessmentSectionId,
} from "./parent-assessment";

/**
 * Sprint 5 restructured WIZARD_STEPS into 11 single-question-group
 * screens. These tests guard the invariant that every section in
 * ASSESSMENT_SECTION_ORDER appears in exactly one step — submit
 * validation depends on every required section being reachable from
 * the UI, otherwise a parent could get stuck.
 */
describe("WIZARD_STEPS coverage", () => {
  it("covers every section in ASSESSMENT_SECTION_ORDER", () => {
    const covered = new Set<AssessmentSectionId>();
    for (const step of WIZARD_STEPS) {
      for (const sec of step.sections) covered.add(sec);
    }
    for (const sec of ASSESSMENT_SECTION_ORDER) {
      expect(covered.has(sec), `section ${sec} missing from WIZARD_STEPS`).toBe(true);
    }
  });

  it("never assigns a section to more than one step", () => {
    const seen = new Map<AssessmentSectionId, number>();
    for (const step of WIZARD_STEPS) {
      for (const sec of step.sections) {
        const prev = seen.get(sec);
        expect(prev, `section ${sec} appears in steps ${prev} and ${step.id}`).toBeUndefined();
        seen.set(sec, step.id);
      }
    }
  });

  it("renders 11 calm screens (sprint 5 spec)", () => {
    expect(WIZARD_STEPS.length).toBe(11);
  });

  it("attaches a long label + helper to every step", () => {
    for (const step of WIZARD_STEPS) {
      expect(step.longLabel, `step ${step.id} missing longLabel`).toBeTruthy();
      expect(step.helper, `step ${step.id} missing helper`).toBeTruthy();
    }
  });

  it("preserves the brain-clone-feeding sections (basics, background, strengths, learning_profile)", () => {
    const all = WIZARD_STEPS.flatMap((s) => s.sections);
    for (const sec of ["basics", "background", "strengths", "learning_profile"] as const) {
      expect(all).toContain(sec);
    }
  });

  it("first step contains learner background (basics + background)", () => {
    expect(WIZARD_STEPS[0]!.sections).toEqual(expect.arrayContaining(["basics", "background"]));
  });
});

describe("validateSection still accepts the restructured payloads", () => {
  it("accepts a minimal grade_subject answer", () => {
    const r = validateSection("grade_subject", {
      gradeBand: "3-5",
      focusSubjects: ["math"],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects grade_subject with no focusSubjects", () => {
    const r = validateSection("grade_subject", {
      gradeBand: "3-5",
      focusSubjects: [],
    });
    expect(r.ok).toBe(false);
  });

  it("accepts optional sections (basics/strengths/background) with empty objects", () => {
    for (const sec of ["basics", "strengths", "background", "learning_profile"] as const) {
      expect(validateSection(sec, {}).ok, `${sec} should accept {}`).toBe(true);
    }
  });

  it("schemas remain frozen for all 17 ids", () => {
    const ids = Object.keys(assessmentSectionSchemas);
    expect(ids.length).toBe(17);
  });
});
