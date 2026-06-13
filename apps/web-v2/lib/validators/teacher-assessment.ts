import { z } from "zod";

/**
 * Sprint C-07 — teacher assessment wizard validators.
 *
 * Mirrors `lib/validators/parent-assessment.ts`: one Zod schema per
 * wizard section, a per-step grouping, and a `validateSection` helper.
 * The wizard PATCHes a single section per step (autosave); the BFF
 * submit maps the draft into the assessment-svc `POST /api/assessments/
 * teacher` payload (`teacherRole`, `gradeLevel`, `subjectArea`,
 * `strengths[]`, `challenges[]`, `accommodations[]`, `observations`,
 * `recommendedFocusAreas[]`, `additionalResponses`).
 *
 * The teacher backend treats every field except `learnerId` as optional,
 * so these section schemas accept partial professional input — a teacher
 * with six minutes between classes can submit strengths + a couple of
 * supports and still produce a useful contribution. We DO require the
 * primary `context` selectors (role + grade) so the submission reads as a
 * deliberate professional contribution rather than an empty row.
 */

export const teacherAssessmentSectionSchemas = {
  // S1 — Context: who is contributing and the classroom frame. Uses
  // school constructs (teacher role, grade band, subject area).
  context: z.object({
    teacherRole: z.enum([
      "general_ed",
      "special_ed",
      "intervention",
      "subject_specialist",
      "paraeducator",
      "related_service",
      "other",
    ]),
    gradeLevel: z.enum([
      "preK",
      "K",
      "1-2",
      "3-5",
      "6-8",
      "9-12",
      "post_secondary",
      "multi_grade",
    ]),
    subjectAreas: z.array(z.string().max(60)).max(8).optional(),
  }),

  // S2 — Strengths first. What the learner does well in this classroom,
  // and (seeded from the same screen) where the teacher would focus.
  strengths: z.object({
    strengths: z.array(z.string().max(200)).max(12).optional(),
    recommendedFocusAreas: z.array(z.string().max(200)).max(8).optional(),
  }),

  // S3 — What gets in the way + what already works. Framed in school
  // constructs: classroom challenges, and supports already working from
  // an IEP/504 or the teacher's own practice.
  supports: z.object({
    challenges: z.array(z.string().max(200)).max(12).optional(),
    accommodations: z.array(z.string().max(200)).max(20).optional(),
    /** Which formal plan, if any, the supports come from. Drives copy only. */
    planContext: z.enum(["iep", "504", "mtss_rti", "informal", "none"]).optional(),
  }),

  // S4 — Observations + anything else. Narrative + optional structured
  // extras that flow into the backend's `additionalResponses` JSON.
  observations: z.object({
    observations: z.string().max(8000).optional(),
    /** Optional best window the teacher sees focus land (extra signal). */
    bestEngagementWindow: z
      .enum(["morning", "midday", "afternoon", "varies"])
      .optional(),
    /** Optional free-text "anything else" captured under additionalResponses. */
    additionalNotes: z.string().max(2000).optional(),
  }),
} as const;

export type TeacherAssessmentSectionId = keyof typeof teacherAssessmentSectionSchemas;

/** Canonical persistence order of the four sections. */
export const TEACHER_ASSESSMENT_SECTION_ORDER: TeacherAssessmentSectionId[] = [
  "context",
  "strengths",
  "supports",
  "observations",
];

/**
 * One wizard step per section plus a final review step. Each step carries
 * i18n keys (resolved by the page under `teacher.learner_assessment`) so
 * no user-facing copy is hardcoded here.
 */
export const TEACHER_WIZARD_STEPS: {
  id: number;
  section: TeacherAssessmentSectionId | "review";
  /** i18n key suffix for the step's short label + long header + helper. */
  key: string;
}[] = [
  { id: 1, section: "context", key: "context" },
  { id: 2, section: "strengths", key: "strengths" },
  { id: 3, section: "supports", key: "supports" },
  { id: 4, section: "observations", key: "observations" },
  { id: 5, section: "review", key: "review" },
];

/** Total non-review steps — used for time-left + progress math. */
export const TEACHER_WIZARD_INPUT_STEPS = TEACHER_ASSESSMENT_SECTION_ORDER.length;

export function validateTeacherSection(
  section: TeacherAssessmentSectionId,
  data: unknown,
): { ok: true; data: Record<string, unknown> } | { ok: false; message: string } {
  const schema = teacherAssessmentSectionSchemas[section];
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.message };
  }
  return { ok: true, data: parsed.data as Record<string, unknown> };
}

/**
 * Shape of the accumulated draft answers persisted per learner. Section
 * keys map to open-shape records (the section Zod schemas above validate
 * them at patch time); modelling them loosely here lets the draft store's
 * generic `Record<string, unknown>` answers flow into the projection
 * helpers without a cast at every call site. The readers below narrow the
 * specific fields they use.
 */
export type TeacherAssessmentAnswers = Partial<Record<TeacherAssessmentSectionId, Record<string, unknown>>>;

/** Read a string field from an open-shape section, or undefined. */
function readStr(section: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = section?.[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** Read a string[] field from an open-shape section (empty when absent). */
function readList(section: Record<string, unknown> | undefined, key: string): string[] {
  const v = section?.[key];
  return Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : [];
}

/** Map the section role enum to the free-text label assessment-svc stores. */
export const TEACHER_ROLE_LABELS: Record<string, string> = {
  general_ed: "General Ed Teacher",
  special_ed: "Special Ed Teacher",
  intervention: "Intervention Specialist",
  subject_specialist: "Subject Specialist",
  paraeducator: "Paraeducator",
  related_service: "Related Service Provider",
  other: "Teacher",
};

/**
 * Project the accumulated draft answers into the assessment-svc submit
 * payload (system of record). Pure + deterministic so the BFF and a test
 * can both call it. `additionalResponses` carries the structured extras
 * the flat columns don't have a home for.
 */
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
  const ctx = answers.context;
  const sup = answers.supports;
  const obs = answers.observations;

  const teacherRole = readStr(ctx, "teacherRole");
  const gradeLevel = readStr(ctx, "gradeLevel");
  const subjectAreas = readList(ctx, "subjectAreas");
  const planContext = readStr(sup, "planContext");
  const bestEngagementWindow = readStr(obs, "bestEngagementWindow");
  const additionalNotes = readStr(obs, "additionalNotes");
  const observations = readStr(obs, "observations");

  const additionalResponses: Record<string, unknown> = {};
  if (subjectAreas.length > 1) additionalResponses.subjectAreas = subjectAreas;
  if (planContext) additionalResponses.planContext = planContext;
  if (bestEngagementWindow) additionalResponses.bestEngagementWindow = bestEngagementWindow;
  if (additionalNotes) additionalResponses.additionalNotes = additionalNotes;

  return {
    learnerId,
    ...(teacherRole ? { teacherRole: TEACHER_ROLE_LABELS[teacherRole] ?? "Teacher" } : {}),
    ...(gradeLevel ? { gradeLevel } : {}),
    // The flat column takes the first/primary subject; the full list (if
    // any) rides in additionalResponses so nothing is lost.
    ...(subjectAreas.length > 0 ? { subjectArea: subjectAreas[0] } : {}),
    strengths: readList(answers.strengths, "strengths"),
    challenges: readList(sup, "challenges"),
    accommodations: readList(sup, "accommodations"),
    ...(observations ? { observations } : {}),
    recommendedFocusAreas: readList(answers.strengths, "recommendedFocusAreas"),
    additionalResponses,
  };
}

/**
 * Build the one-line summary insight mirrored to family-svc
 * (`createTeacherInsight`) so the brain-clone collaborator fold sees the
 * teacher's contribution. Strengths-first, plain language, and honest:
 * it names the supports the teacher recommended (what parents actually
 * see), never raw disability signals.
 */
export function toTeacherInsightSummary(
  learnerName: string,
  answers: TeacherAssessmentAnswers,
): { insightText: string; domain: string } {
  const strengths = readList(answers.strengths, "strengths");
  const accommodations = readList(answers.supports, "accommodations");
  const focus = readList(answers.strengths, "recommendedFocusAreas");

  const parts: string[] = [];
  if (strengths.length > 0) {
    parts.push(`Classroom strengths: ${strengths.slice(0, 4).join(", ")}.`);
  }
  if (accommodations.length > 0) {
    parts.push(`Supports that work: ${accommodations.slice(0, 4).join(", ")}.`);
  }
  if (focus.length > 0) {
    parts.push(`Suggested focus: ${focus.slice(0, 3).join(", ")}.`);
  }
  const insightText =
    parts.length > 0
      ? `Teacher read on ${learnerName}. ${parts.join(" ")}`
      : `A teacher completed a classroom assessment for ${learnerName}.`;

  // "classroom" domain keeps the fold's domain-mapping conservative —
  // it acknowledges the perspective without forcing a clinical support.
  return { insightText, domain: "classroom" };
}
