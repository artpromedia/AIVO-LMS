import { z } from "zod";
import {
  TEACHER_ASSESSMENT_SECTION_ORDER,
  getSection,
  optionLabel,
  type TeacherAssessmentSectionId,
} from "@/lib/teacher/assessment-content";

/**
 * Teacher assessment validators — content-driven.
 *
 * The 8-section "Classroom insights" question bank lives in
 * lib/teacher/assessment-content.ts; this module derives one Zod schema per
 * section from that content (single → enum, multi → array of enums, text →
 * bounded string, every field optional so a partial professional contribution
 * is accepted) and projects the accumulated answers into the assessment-svc
 * submit payload (system of record) + the family-svc summary insight that the
 * brain-clone collaborator fold reads.
 *
 * The wizard PATCHes one section per step (autosave); the BFF submit maps the
 * draft into `POST /api/assessments/teacher` (`teacherRole`, `gradeLevel`,
 * `subjectArea`, `strengths[]`, `challenges[]`, `accommodations[]`,
 * `observations`, `recommendedFocusAreas[]`, `additionalResponses`). Every
 * field except `learnerId` is optional there, so the projection drops empty
 * sections cleanly and stows the full structured answers under
 * `additionalResponses` so nothing is ever lost.
 */

export { TEACHER_ASSESSMENT_SECTION_ORDER };
export type { TeacherAssessmentSectionId };

/**
 * Shape of the accumulated draft answers persisted per learner. Section keys
 * map to open-shape records (`questionId → string | string[]`); the section
 * schemas validate them at patch time, the readers below narrow as needed.
 */
export type TeacherAssessmentAnswers = Partial<
  Record<TeacherAssessmentSectionId, Record<string, unknown>>
>;

/* ----- schemas (derived from content) -------------------------------------- */

const TEXT_MAX = 4000;

function buildSectionSchema(id: TeacherAssessmentSectionId): z.ZodTypeAny {
  const section = getSection(id);
  if (!section) return z.object({}).strict();
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const q of section.questions) {
    if (q.type === "text") {
      shape[q.id] = z.string().max(TEXT_MAX).optional();
      continue;
    }
    const values = (q.options ?? []).map((o) => o.value);
    if (values.length === 0) {
      shape[q.id] = z.string().max(200).optional();
      continue;
    }
    const enumSchema = z.enum(values as [string, ...string[]]);
    shape[q.id] =
      q.type === "multi"
        ? z.array(enumSchema).max(values.length).optional()
        : enumSchema.optional();
  }
  // `.strict()` rejects unknown question ids so a stale client can't smuggle
  // arbitrary keys into the JSONB draft.
  return z.object(shape).strict();
}

const SECTION_SCHEMAS: Record<TeacherAssessmentSectionId, z.ZodTypeAny> =
  TEACHER_ASSESSMENT_SECTION_ORDER.reduce(
    (acc, id) => {
      acc[id] = buildSectionSchema(id);
      return acc;
    },
    {} as Record<TeacherAssessmentSectionId, z.ZodTypeAny>,
  );

export function validateTeacherSection(
  section: TeacherAssessmentSectionId,
  data: unknown,
): { ok: true; data: Record<string, unknown> } | { ok: false; message: string } {
  const schema = SECTION_SCHEMAS[section];
  if (!schema) return { ok: false, message: `Unknown section: ${section}` };
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.message };
  }
  return { ok: true, data: parsed.data as Record<string, unknown> };
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
): {
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
} {
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
