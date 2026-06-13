/**
 * Sprint C-07 — teacher assessment validators + projection helpers.
 *
 * Covers: per-section validation (required context fields, optional rest),
 * the submit-payload projection (flat columns + additionalResponses, the
 * role-label mapping, the first-subject rule), and the summary-insight
 * builder (strengths-first, supports named, honest fallback).
 */
import { describe, it, expect } from "vitest";
import {
  validateTeacherSection,
  toTeacherSubmitPayload,
  toTeacherInsightSummary,
  TEACHER_ASSESSMENT_SECTION_ORDER,
  TEACHER_WIZARD_STEPS,
  type TeacherAssessmentAnswers,
} from "./teacher-assessment";

describe("validateTeacherSection — context", () => {
  it("requires teacherRole and gradeLevel", () => {
    expect(validateTeacherSection("context", {}).ok).toBe(false);
    expect(validateTeacherSection("context", { teacherRole: "general_ed" }).ok).toBe(false);
    const ok = validateTeacherSection("context", {
      teacherRole: "general_ed",
      gradeLevel: "3-5",
    });
    expect(ok.ok).toBe(true);
  });

  it("rejects an unknown role / grade enum", () => {
    expect(
      validateTeacherSection("context", { teacherRole: "principal", gradeLevel: "3-5" }).ok,
    ).toBe(false);
    expect(
      validateTeacherSection("context", { teacherRole: "general_ed", gradeLevel: "13" }).ok,
    ).toBe(false);
  });

  it("accepts optional subjectAreas", () => {
    const r = validateTeacherSection("context", {
      teacherRole: "special_ed",
      gradeLevel: "6-8",
      subjectAreas: ["math", "reading"],
    });
    expect(r.ok).toBe(true);
  });
});

describe("validateTeacherSection — optional sections accept partial input", () => {
  it("strengths: empty object is valid (every field optional)", () => {
    expect(validateTeacherSection("strengths", {}).ok).toBe(true);
    expect(validateTeacherSection("strengths", { strengths: ["asks questions"] }).ok).toBe(true);
  });

  it("supports: validates plan enum, accepts free lists", () => {
    expect(validateTeacherSection("supports", { planContext: "iep" }).ok).toBe(true);
    expect(validateTeacherSection("supports", { planContext: "guess" }).ok).toBe(false);
    expect(
      validateTeacherSection("supports", { accommodations: ["extended time"] }).ok,
    ).toBe(true);
  });

  it("observations: caps the narrative length", () => {
    expect(validateTeacherSection("observations", { observations: "fine" }).ok).toBe(true);
    expect(
      validateTeacherSection("observations", { observations: "x".repeat(8001) }).ok,
    ).toBe(false);
  });
});

describe("section order + wizard steps stay in sync", () => {
  it("has four input sections and a review step", () => {
    expect(TEACHER_ASSESSMENT_SECTION_ORDER).toEqual([
      "context",
      "strengths",
      "supports",
      "observations",
    ]);
    const inputSteps = TEACHER_WIZARD_STEPS.filter((s) => s.section !== "review");
    expect(inputSteps.map((s) => s.section)).toEqual(TEACHER_ASSESSMENT_SECTION_ORDER);
    expect(TEACHER_WIZARD_STEPS.at(-1)!.section).toBe("review");
  });
});

describe("toTeacherSubmitPayload", () => {
  const answers: TeacherAssessmentAnswers = {
    context: { teacherRole: "general_ed", gradeLevel: "3-5", subjectAreas: ["math", "reading"] },
    strengths: { strengths: ["number sense"], recommendedFocusAreas: ["fluency"] },
    supports: { challenges: ["long blocks"], accommodations: ["chunked"], planContext: "iep" },
    observations: { observations: "Mornings are best.", bestEngagementWindow: "morning" },
  };

  it("maps the role enum to the assessment-svc label and lifts the primary subject", () => {
    const p = toTeacherSubmitPayload("lrn-1", answers);
    expect(p.learnerId).toBe("lrn-1");
    expect(p.teacherRole).toBe("General Ed Teacher");
    expect(p.gradeLevel).toBe("3-5");
    expect(p.subjectArea).toBe("math"); // first subject lifted to the flat column
  });

  it("carries the extras the flat columns can't hold in additionalResponses", () => {
    const p = toTeacherSubmitPayload("lrn-1", answers);
    expect(p.additionalResponses.subjectAreas).toEqual(["math", "reading"]);
    expect(p.additionalResponses.planContext).toBe("iep");
    expect(p.additionalResponses.bestEngagementWindow).toBe("morning");
    expect(p.strengths).toEqual(["number sense"]);
    expect(p.challenges).toEqual(["long blocks"]);
    expect(p.accommodations).toEqual(["chunked"]);
    expect(p.recommendedFocusAreas).toEqual(["fluency"]);
    expect(p.observations).toBe("Mornings are best.");
  });

  it("degrades gracefully for a near-empty draft (everything optional)", () => {
    const p = toTeacherSubmitPayload("lrn-2", { strengths: { strengths: ["kind to peers"] } });
    expect(p.learnerId).toBe("lrn-2");
    expect(p.teacherRole).toBeUndefined();
    expect(p.gradeLevel).toBeUndefined();
    expect(p.subjectArea).toBeUndefined();
    expect(p.strengths).toEqual(["kind to peers"]);
    expect(p.challenges).toEqual([]);
    expect(p.additionalResponses).toEqual({});
  });

  it("does not duplicate a single subject into additionalResponses", () => {
    const p = toTeacherSubmitPayload("lrn-3", {
      context: { teacherRole: "other", gradeLevel: "K", subjectAreas: ["math"] },
    });
    expect(p.subjectArea).toBe("math");
    expect(p.additionalResponses.subjectAreas).toBeUndefined();
  });
});

describe("toTeacherInsightSummary", () => {
  it("is strengths-first and names the recommended supports", () => {
    const s = toTeacherInsightSummary("Mia", {
      strengths: { strengths: ["number sense", "persistence"], recommendedFocusAreas: ["fluency"] },
      supports: { accommodations: ["extended time"] },
    });
    expect(s.domain).toBe("classroom");
    expect(s.insightText).toContain("Mia");
    expect(s.insightText.indexOf("strengths")).toBeLessThan(s.insightText.indexOf("Supports"));
    expect(s.insightText).toContain("extended time");
    expect(s.insightText).toContain("fluency");
  });

  it("falls back to an honest minimal line when nothing concrete was entered", () => {
    const s = toTeacherInsightSummary("Theo", {});
    expect(s.insightText).toContain("Theo");
    expect(s.insightText.toLowerCase()).toContain("teacher");
  });
});
