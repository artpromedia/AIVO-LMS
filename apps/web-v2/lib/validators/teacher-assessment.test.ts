/**
 * Teacher assessment validators + projection helpers (8-section rebuild).
 *
 * Covers: content-driven per-section validation (enum single, array multi,
 * bounded text, strict unknown-key rejection, every field optional), the
 * submit-payload projection (flat columns + full structured answers under
 * additionalResponses.sections, role-label mapping, first-subject rule,
 * concern → challenge mapping that drops "none"), and the summary-insight
 * builder (strengths-first, supports named, honest fallback).
 */
import { describe, it, expect } from "vitest";
import {
  validateTeacherSection,
  toTeacherSubmitPayload,
  toTeacherInsightSummary,
  TEACHER_ASSESSMENT_SECTION_ORDER,
  type TeacherAssessmentAnswers,
} from "./teacher-assessment";

describe("validateTeacherSection — content-driven", () => {
  it("accepts an empty section (every question optional)", () => {
    expect(validateTeacherSection("learning_engagement", {}).ok).toBe(true);
  });

  it("accepts valid single + multi answers", () => {
    expect(validateTeacherSection("learning_engagement", { le_motivation: "hands_on" }).ok).toBe(
      true,
    );
    expect(
      validateTeacherSection("learning_engagement", {
        le_interest_topics: ["reading", "art"],
      }).ok,
    ).toBe(true);
  });

  it("rejects an out-of-enum option value", () => {
    expect(validateTeacherSection("learning_engagement", { le_motivation: "bogus" }).ok).toBe(false);
    expect(
      validateTeacherSection("classroom_context", { cc_role: "principal", cc_grade: "3-5" }).ok,
    ).toBe(false);
  });

  it("rejects an unknown question id (strict — no JSONB smuggling)", () => {
    expect(validateTeacherSection("learning_engagement", { not_a_question: "x" }).ok).toBe(false);
  });

  it("caps text answers", () => {
    expect(validateTeacherSection("final_notes", { fn_goals: "fine" }).ok).toBe(true);
    expect(validateTeacherSection("final_notes", { fn_goals: "x".repeat(4001) }).ok).toBe(false);
  });

  it("rejects an unknown section id", () => {
    // @ts-expect-error — exercising the runtime guard for a stale client.
    expect(validateTeacherSection("nope", {}).ok).toBe(false);
  });
});

describe("section order", () => {
  it("is the canonical eight sections in order", () => {
    expect(TEACHER_ASSESSMENT_SECTION_ORDER).toEqual([
      "learning_engagement",
      "attention_regulation",
      "communication_style",
      "task_independence",
      "academic_strengths",
      "support_strategies",
      "classroom_context",
      "final_notes",
    ]);
  });
});

describe("toTeacherSubmitPayload", () => {
  const answers: TeacherAssessmentAnswers = {
    classroom_context: {
      cc_role: "general_ed",
      cc_grade: "3-5",
      cc_subject: ["reading", "math"],
    },
    academic_strengths: {
      as_strong_subjects: ["reading", "math"],
      as_strengths_notes: "Retold a story with a drawing.",
    },
    support_strategies: {
      ss_accommodations: ["extended_time"],
      ss_working_now: ["visual_schedule"],
      ss_focus_areas: ["reading", "attention"],
    },
    final_notes: {
      fn_concerns: ["attention", "none"],
      fn_celebrate: "Kind to peers.",
      fn_goals: "Build reading stamina.",
    },
  };

  it("maps the role enum to the assessment-svc label and lifts the first subject", () => {
    const p = toTeacherSubmitPayload("lrn-1", answers);
    expect(p.learnerId).toBe("lrn-1");
    expect(p.teacherRole).toBe("General Ed Teacher");
    expect(p.gradeLevel).toBe("3-5");
    expect(p.subjectArea).toBe("Reading / ELA"); // first cc_subject label
    expect(p.additionalResponses.subjectAreas).toEqual(["Reading / ELA", "Math"]);
  });

  it("projects labelled strengths, deduped accommodations, focus, and concern→challenge", () => {
    const p = toTeacherSubmitPayload("lrn-1", answers);
    expect(p.strengths).toEqual(["Reading", "Math"]);
    expect(p.accommodations).toEqual(["Extended time", "Visual schedule"]);
    expect(p.recommendedFocusAreas).toEqual(["Reading", "Attention"]);
    expect(p.challenges).toEqual(["Attention"]); // "none" dropped
  });

  it("joins the free-text notes into observations", () => {
    const p = toTeacherSubmitPayload("lrn-1", answers);
    expect(p.observations).toContain("Kind to peers.");
    expect(p.observations).toContain("Build reading stamina.");
    expect(p.observations).toContain("Retold a story with a drawing.");
  });

  it("stows the full structured answers under additionalResponses.sections", () => {
    const p = toTeacherSubmitPayload("lrn-1", answers);
    expect(p.additionalResponses.sections).toEqual(answers);
  });

  it("degrades gracefully for a near-empty draft (everything optional)", () => {
    const p = toTeacherSubmitPayload("lrn-2", {
      academic_strengths: { as_strong_subjects: ["reading"] },
    });
    expect(p.learnerId).toBe("lrn-2");
    expect(p.teacherRole).toBeUndefined();
    expect(p.gradeLevel).toBeUndefined();
    expect(p.subjectArea).toBeUndefined();
    expect(p.strengths).toEqual(["Reading"]);
    expect(p.challenges).toEqual([]);
    expect(p.accommodations).toEqual([]);
  });

  it("does not duplicate a single subject into additionalResponses", () => {
    const p = toTeacherSubmitPayload("lrn-3", {
      classroom_context: { cc_role: "other", cc_grade: "K", cc_subject: ["math"] },
    });
    expect(p.subjectArea).toBe("Math");
    expect(p.additionalResponses.subjectAreas).toBeUndefined();
  });
});

describe("toTeacherInsightSummary", () => {
  it("is strengths-first and names the recommended supports", () => {
    const s = toTeacherInsightSummary("Mia", {
      academic_strengths: { as_strong_subjects: ["reading", "math"] },
      support_strategies: {
        ss_working_now: ["visual_schedule"],
        ss_focus_areas: ["reading"],
      },
    });
    expect(s.domain).toBe("classroom");
    expect(s.insightText).toContain("Mia");
    expect(s.insightText.indexOf("strengths")).toBeLessThan(s.insightText.indexOf("Supports"));
    expect(s.insightText).toContain("Reading");
    expect(s.insightText).toContain("Visual schedule");
  });

  it("falls back to an honest minimal line when nothing concrete was entered", () => {
    const s = toTeacherInsightSummary("Theo", {});
    expect(s.insightText).toContain("Theo");
    expect(s.insightText.toLowerCase()).toContain("teacher");
  });
});
