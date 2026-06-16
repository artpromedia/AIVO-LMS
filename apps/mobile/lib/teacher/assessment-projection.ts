/**
 * Teacher assessment projection (mobile).
 *
 * Projects the accumulated wizard answers into:
 *   - the assessment-svc submit payload (system of record) — every field but
 *     `learnerId` optional, so a partial professional contribution is accepted
 *     and the full structured answers ride along under `additionalResponses`;
 *   - the family-svc summary insight the brain-clone collaborator fold reads.
 *
 * Faithful port of web-v2's `lib/validators/teacher-assessment.ts` projections
 * (minus the zod section schemas — mobile accumulates answers in local state
 * and submits once, so per-section autosave validation is not needed here).
 * Reads option LABELS from the content module so the payload stays
 * human-readable and the two surfaces never drift.
 */
import {
  getSection,
  optionLabel,
  type TeacherAssessmentSectionId,
} from "./assessment-content";

/**
 * Accumulated draft answers: section id → (questionId → string | string[]).
 */
export type TeacherAssessmentAnswers = Partial<
  Record<TeacherAssessmentSectionId, Record<string, unknown>>
>;

export interface TeacherSubmitPayload {
  learnerId: string;
  teacherRole?: string;
  gradeLevel?: string;
  subjectArea?: string;
  strengths: string[];
  challenges: string[];
  accommodations: string[];
  observations?: string;
  recommendedFocusAreas: string[];
  additionalResponses: Record<string, unknown>;
}

/* ----- answer readers ------------------------------------------------------- */

function sectionAnswers(
  answers: TeacherAssessmentAnswers,
  id: TeacherAssessmentSectionId,
): Record<string, unknown> {
  return (answers[id] ?? {}) as Record<string, unknown>;
}

function readSingle(
  answers: TeacherAssessmentAnswers,
  id: TeacherAssessmentSectionId,
  questionId: string,
): string | undefined {
  const v = sectionAnswers(answers, id)[questionId];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function readMulti(
  answers: TeacherAssessmentAnswers,
  id: TeacherAssessmentSectionId,
  questionId: string,
): string[] {
  const v = sectionAnswers(answers, id)[questionId];
  return Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : [];
}

function readText(
  answers: TeacherAssessmentAnswers,
  id: TeacherAssessmentSectionId,
  questionId: string,
): string | undefined {
  const v = sectionAnswers(answers, id)[questionId];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

function labelsOf(
  id: TeacherAssessmentSectionId,
  questionId: string,
  values: string[],
): string[] {
  return values.map((v) => optionLabel(id, questionId, v));
}

function dedupe(list: string[]): string[] {
  return Array.from(new Set(list));
}

/* ----- role labels (kept for compatibility) -------------------------------- */

/**
 * Map a classroom-context role value to the free-text label assessment-svc
 * stores. Derived from the content option labels so the two never drift.
 */
export const TEACHER_ROLE_LABELS: Record<string, string> = Object.fromEntries(
  (getSection("classroom_context")?.questions.find((q) => q.id === "cc_role")?.options ?? []).map(
    (o) => [o.value, o.label],
  ),
);

/* ----- projection: assessment-svc submit payload --------------------------- */

export function toTeacherSubmitPayload(
  learnerId: string,
  answers: TeacherAssessmentAnswers,
): TeacherSubmitPayload {
  const roleVal = readSingle(answers, "classroom_context", "cc_role");
  const teacherRole = roleVal ? optionLabel("classroom_context", "cc_role", roleVal) : undefined;
  const gradeLevel = readSingle(answers, "classroom_context", "cc_grade");
  const subjects = labelsOf(
    "classroom_context",
    "cc_subject",
    readMulti(answers, "classroom_context", "cc_subject"),
  );

  const strengths = labelsOf(
    "academic_strengths",
    "as_strong_subjects",
    readMulti(answers, "academic_strengths", "as_strong_subjects"),
  );

  const accommodations = dedupe([
    ...labelsOf(
      "support_strategies",
      "ss_accommodations",
      readMulti(answers, "support_strategies", "ss_accommodations"),
    ),
    ...labelsOf(
      "support_strategies",
      "ss_working_now",
      readMulti(answers, "support_strategies", "ss_working_now"),
    ),
  ]);

  const recommendedFocusAreas = labelsOf(
    "support_strategies",
    "ss_focus_areas",
    readMulti(answers, "support_strategies", "ss_focus_areas"),
  );

  const challenges = labelsOf(
    "final_notes",
    "fn_concerns",
    readMulti(answers, "final_notes", "fn_concerns").filter((v) => v !== "none"),
  );

  const observations = [
    readText(answers, "final_notes", "fn_celebrate"),
    readText(answers, "final_notes", "fn_goals"),
    readText(answers, "final_notes", "fn_anything"),
    readText(answers, "academic_strengths", "as_strengths_notes"),
  ]
    .filter(Boolean)
    .join("\n\n");

  const additionalResponses: Record<string, unknown> = {
    // Full structured answers so nothing the flat columns can't hold is lost.
    sections: answers,
  };
  if (subjects.length > 1) additionalResponses.subjectAreas = subjects;

  return {
    learnerId,
    ...(teacherRole ? { teacherRole } : {}),
    ...(gradeLevel ? { gradeLevel } : {}),
    ...(subjects.length > 0 ? { subjectArea: subjects[0] } : {}),
    strengths,
    challenges,
    accommodations,
    ...(observations ? { observations } : {}),
    recommendedFocusAreas,
    additionalResponses,
  };
}

/* ----- projection: family-svc summary insight ------------------------------ */

export function toTeacherInsightSummary(
  learnerName: string,
  answers: TeacherAssessmentAnswers,
): { insightText: string; domain: string } {
  const strengths = labelsOf(
    "academic_strengths",
    "as_strong_subjects",
    readMulti(answers, "academic_strengths", "as_strong_subjects"),
  );
  const accommodations = dedupe([
    ...labelsOf(
      "support_strategies",
      "ss_working_now",
      readMulti(answers, "support_strategies", "ss_working_now"),
    ),
    ...labelsOf(
      "support_strategies",
      "ss_accommodations",
      readMulti(answers, "support_strategies", "ss_accommodations"),
    ),
  ]);
  const focus = labelsOf(
    "support_strategies",
    "ss_focus_areas",
    readMulti(answers, "support_strategies", "ss_focus_areas"),
  );

  const parts: string[] = [];
  if (strengths.length > 0) parts.push(`Classroom strengths: ${strengths.slice(0, 4).join(", ")}.`);
  if (accommodations.length > 0)
    parts.push(`Supports that work: ${accommodations.slice(0, 4).join(", ")}.`);
  if (focus.length > 0) parts.push(`Suggested focus: ${focus.slice(0, 3).join(", ")}.`);

  const insightText =
    parts.length > 0
      ? `Teacher read on ${learnerName}. ${parts.join(" ")}`
      : `A teacher completed a classroom assessment for ${learnerName}.`;

  return { insightText, domain: "classroom" };
}
