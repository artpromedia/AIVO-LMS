/**
 * Sprint C-07 — Teacher assessment wizard (steps 1–4).
 *
 * The teacher counterpart of the parent wizard, built from the same
 * `packages/ui/src/assessment` primitives and the same section-patch
 * autosave pattern: a server action validates ONE section per step and
 * persists it to the web-v2 teacher-draft store, so closing the tab
 * mid-step and reopening resumes exactly where the teacher left off.
 *
 * Final submit lives on the review screen (a client island) which calls
 * the BFF — that writes the system-of-record row to assessment-svc,
 * captures elapsed-time telemetry, and mirrors a summary insight so the
 * brain-clone collaborator fold sees the contribution.
 *
 * Roster-scoped: a teacher visiting a learner not on their roster gets a
 * 404 (the BFF independently returns 403 for writes — Trust rule).
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import {
  AssessmentShell,
  AssessmentProgress,
  QuestionCard,
  PillCardGroup,
  SoftTextField,
  AssessmentFooter,
  ASSESSMENT_BACK_CLASS,
  ASSESSMENT_GHOST_CLASS,
  ReassuranceCard,
} from "@aivo/ui";
import {
  getLearner,
  teacherCanAccessLearner,
  getOrCreateTeacherAssessmentDraft,
  patchTeacherAssessmentSection,
} from "@/lib/db/repos";
import { audit } from "@/lib/bff/audit";
import { newRequestId } from "@/lib/observability/logger";
import {
  TEACHER_WIZARD_STEPS,
  TEACHER_WIZARD_INPUT_STEPS,
  validateTeacherSection,
  type TeacherAssessmentSectionId,
} from "@/lib/validators/teacher-assessment";
import type { TeacherAssessmentDraft } from "@/lib/db/types";

/* ----- helpers -------------------------------------------------------------- */

function parseList(raw: string, max = 12): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

function sectionAnswers(
  draft: TeacherAssessmentDraft,
  section: TeacherAssessmentSectionId,
): Record<string, unknown> {
  return (draft.answers[section] ?? {}) as Record<string, unknown>;
}

function fieldString(
  draft: TeacherAssessmentDraft,
  section: TeacherAssessmentSectionId,
  field: string,
): string {
  const v = sectionAnswers(draft, section)[field];
  if (Array.isArray(v)) return v.join("\n");
  if (v === undefined || v === null) return "";
  return String(v);
}

function fieldArray(
  draft: TeacherAssessmentDraft,
  section: TeacherAssessmentSectionId,
  field: string,
): string[] {
  const v = sectionAnswers(draft, section)[field];
  return Array.isArray(v) ? (v as string[]) : [];
}

/* ----- server action -------------------------------------------------------- */

async function saveTeacherStepAction(formData: FormData) {
  "use server";
  const { getSession } = await import("@/lib/auth/session");
  const session = await getSession();
  if (!session || session.role !== "teacher") redirect("/login");
  const learnerId = String(formData.get("learnerId") || "");
  const stepNum = Number.parseInt(String(formData.get("step") || "1"), 10);
  if (!(await teacherCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    redirect("/teacher/learners");
  }
  const step = TEACHER_WIZARD_STEPS.find((s) => s.id === stepNum);
  if (!step || step.section === "review") {
    redirect(`/teacher/learners/${learnerId}/assessment?step=1`);
  }
  const sectionId = step!.section as TeacherAssessmentSectionId;

  const sectionData: Record<string, unknown> = {};
  switch (sectionId) {
    case "context": {
      const role = String(formData.get("context.teacherRole") || "");
      if (role) sectionData.teacherRole = role;
      const grade = String(formData.get("context.gradeLevel") || "");
      if (grade) sectionData.gradeLevel = grade;
      const subjects = formData.getAll("context.subjectAreas").map(String).filter(Boolean);
      if (subjects.length > 0) sectionData.subjectAreas = subjects;
      break;
    }
    case "strengths": {
      const strengths = parseList(String(formData.get("strengths.strengths") || ""));
      if (strengths.length > 0) sectionData.strengths = strengths;
      const focus = parseList(String(formData.get("strengths.recommendedFocusAreas") || ""), 8);
      if (focus.length > 0) sectionData.recommendedFocusAreas = focus;
      break;
    }
    case "supports": {
      const challenges = parseList(String(formData.get("supports.challenges") || ""));
      if (challenges.length > 0) sectionData.challenges = challenges;
      const accommodations = parseList(String(formData.get("supports.accommodations") || ""), 20);
      if (accommodations.length > 0) sectionData.accommodations = accommodations;
      const plan = String(formData.get("supports.planContext") || "");
      if (plan) sectionData.planContext = plan;
      break;
    }
    case "observations": {
      const observations = String(formData.get("observations.observations") || "").trim();
      if (observations) sectionData.observations = observations;
      const window = String(formData.get("observations.bestEngagementWindow") || "");
      if (window) sectionData.bestEngagementWindow = window;
      const notes = String(formData.get("observations.additionalNotes") || "").trim();
      if (notes) sectionData.additionalNotes = notes;
      break;
    }
  }

  const v = validateTeacherSection(sectionId, sectionData);
  if (!v.ok) {
    redirect(
      `/teacher/learners/${learnerId}/assessment?step=${stepNum}&error=${encodeURIComponent(
        sectionId,
      )}`,
    );
  }
  await patchTeacherAssessmentSection(
    learnerId,
    session.tenantId,
    session.userId,
    sectionId,
    v.data,
  );
  audit(session, "teacher_assessment.section.patch", newRequestId(), {
    learnerId,
    metadata: { section: sectionId, source: "ui" },
  });

  const nextStep = TEACHER_WIZARD_STEPS.find((s) => s.id === stepNum + 1);
  if (nextStep) {
    redirect(`/teacher/learners/${learnerId}/assessment?step=${nextStep.id}`);
  }
  redirect(`/teacher/learners/${learnerId}/assessment/review`);
}

/* ----- option lists --------------------------------------------------------- */

const ROLE_KEYS = [
  "general_ed",
  "special_ed",
  "intervention",
  "subject_specialist",
  "paraeducator",
  "related_service",
  "other",
] as const;

const GRADE_KEYS = [
  ["preK", "preK"],
  ["K", "K"],
  ["1-2", "1_2"],
  ["3-5", "3_5"],
  ["6-8", "6_8"],
  ["9-12", "9_12"],
  ["post_secondary", "post_secondary"],
  ["multi_grade", "multi_grade"],
] as const;

const SUBJECT_KEYS = [
  "math",
  "reading",
  "writing",
  "science",
  "social_studies",
  "behavior",
  "life_skills",
  "other",
] as const;

const PLAN_KEYS = ["iep", "504", "mtss_rti", "informal", "none"] as const;
const WINDOW_KEYS = ["morning", "midday", "afternoon", "varies"] as const;

/* ----- screen renderer ------------------------------------------------------ */

function renderSection(
  sectionId: TeacherAssessmentSectionId,
  draft: TeacherAssessmentDraft,
  name: string,
  t: (key: string, vars?: Record<string, string>) => string,
): React.ReactElement {
  switch (sectionId) {
    case "context":
      return (
        <div className="flex flex-col gap-5" key={sectionId}>
          <PillCardGroup
            mode="single"
            required
            name="context.teacherRole"
            legend={t("context_role_legend", { name })}
            columns={2}
            options={ROLE_KEYS.map((k) => ({ value: k, label: t(`context_role_${k}`) }))}
            defaultValue={fieldString(draft, "context", "teacherRole")}
          />
          <PillCardGroup
            mode="single"
            required
            name="context.gradeLevel"
            legend={t("context_grade_legend")}
            columns={3}
            options={GRADE_KEYS.map(([value, key]) => ({
              value,
              label: t(`context_grade_${key}`),
            }))}
            defaultValue={fieldString(draft, "context", "gradeLevel")}
          />
          <PillCardGroup
            mode="multi"
            name="context.subjectAreas"
            legend={t("context_subjects_legend")}
            helper={t("context_subjects_helper")}
            columns={3}
            options={SUBJECT_KEYS.map((k) => ({ value: k, label: t(`context_subject_${k}`) }))}
            defaultValues={fieldArray(draft, "context", "subjectAreas")}
          />
        </div>
      );
    case "strengths":
      return (
        <div className="flex flex-col gap-5" key={sectionId}>
          <SoftTextField
            name="strengths.strengths"
            multiline
            label={t("strengths_strengths_label")}
            helper={t("strengths_strengths_helper")}
            placeholder={t("strengths_strengths_placeholder")}
            defaultValue={fieldString(draft, "strengths", "strengths")}
            maxLength={2000}
          />
          <SoftTextField
            name="strengths.recommendedFocusAreas"
            multiline
            label={t("strengths_focus_label")}
            helper={t("strengths_focus_helper")}
            placeholder={t("strengths_focus_placeholder")}
            defaultValue={fieldString(draft, "strengths", "recommendedFocusAreas")}
            maxLength={1000}
          />
        </div>
      );
    case "supports":
      return (
        <div className="flex flex-col gap-5" key={sectionId}>
          <SoftTextField
            name="supports.challenges"
            multiline
            label={t("supports_challenges_label")}
            helper={t("supports_challenges_helper")}
            placeholder={t("supports_challenges_placeholder")}
            defaultValue={fieldString(draft, "supports", "challenges")}
            maxLength={2000}
          />
          <SoftTextField
            name="supports.accommodations"
            multiline
            label={t("supports_accommodations_label")}
            helper={t("supports_accommodations_helper")}
            placeholder={t("supports_accommodations_placeholder")}
            defaultValue={fieldString(draft, "supports", "accommodations")}
            maxLength={3000}
          />
          <PillCardGroup
            mode="single"
            name="supports.planContext"
            legend={t("supports_plan_legend")}
            helper={t("supports_plan_helper")}
            columns={3}
            options={PLAN_KEYS.map((k) => ({ value: k, label: t(`supports_plan_${k}`) }))}
            defaultValue={fieldString(draft, "supports", "planContext")}
          />
        </div>
      );
    case "observations":
      return (
        <div className="flex flex-col gap-5" key={sectionId}>
          <SoftTextField
            name="observations.observations"
            multiline
            label={t("observations_observations_label")}
            helper={t("observations_observations_helper", { name })}
            placeholder={t("observations_observations_placeholder")}
            defaultValue={fieldString(draft, "observations", "observations")}
            maxLength={8000}
          />
          <PillCardGroup
            mode="single"
            name="observations.bestEngagementWindow"
            legend={t("observations_window_legend")}
            helper={t("observations_window_helper")}
            columns={2}
            options={WINDOW_KEYS.map((k) => ({ value: k, label: t(`observations_window_${k}`) }))}
            defaultValue={fieldString(draft, "observations", "bestEngagementWindow")}
          />
          <SoftTextField
            name="observations.additionalNotes"
            multiline
            label={t("observations_notes_label")}
            helper={t("observations_notes_helper")}
            defaultValue={fieldString(draft, "observations", "additionalNotes")}
            maxLength={2000}
          />
        </div>
      );
  }
}

/* ----- reassurance ---------------------------------------------------------- */

function ReassuranceColumn({
  name,
  t,
}: {
  name: string;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  return (
    <>
      <ReassuranceCard
        tone="info"
        title={t("reassure_purpose_title")}
        body={t("reassure_purpose_body", { name })}
      />
      <ReassuranceCard
        tone="info"
        title={t("reassure_strengths_title")}
        body={t("reassure_strengths_body")}
      />
      <ReassuranceCard
        tone="privacy"
        title={t("reassure_privacy_title")}
        body={t("reassure_privacy_body")}
        icon={
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        }
      />
    </>
  );
}

/* ----- page ----------------------------------------------------------------- */

export const dynamic = "force-dynamic";

export default async function TeacherAssessmentWizard({
  params,
  searchParams,
}: {
  params: Promise<{ learnerId: string }>;
  searchParams: Promise<{ step?: string; error?: string }>;
}) {
  const session = await requirePageRole(["teacher"]);
  const t = await getTranslations("teacher.learner_assessment");
  const { learnerId } = await params;
  const sp = await searchParams;
  if (!(await teacherCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();
  const name = learner.displayName;

  const draft = await getOrCreateTeacherAssessmentDraft(learnerId, session.tenantId, session.userId);

  // Brand-new draft with no step param: send the teacher to the calm entry
  // screen first (up-front honesty: "Under 10 minutes. Autosaves as you go.").
  const hasAnyAnswers = Object.values(draft.answers ?? {}).some(
    (v) => v && Object.keys(v).length > 0,
  );
  if (!hasAnyAnswers && !sp.step) {
    redirect(`/teacher/learners/${learnerId}/assessment/intro`);
  }

  const inputSteps = TEACHER_WIZARD_STEPS.filter((s) => s.section !== "review");
  const stepNum = Math.max(1, Math.min(inputSteps.length, Number.parseInt(sp.step || "1", 10) || 1));
  const step = TEACHER_WIZARD_STEPS.find((s) => s.id === stepNum)!;
  const sectionId = step.section as TeacherAssessmentSectionId;
  const isLast = stepNum === inputSteps.length;

  const minutesLeft = TEACHER_WIZARD_INPUT_STEPS - stepNum;
  const timeHint = isLast
    ? t("time_left_last")
    : minutesLeft <= 1
      ? t("time_left_one")
      : t("time_left_other", { count: String(minutesLeft) });

  const errorMessage = sp.error ? t(`error_${sp.error}`) : undefined;

  return (
    <AssessmentShell
      eyebrow={t("eyebrow", { name })}
      progress={
        <AssessmentProgress
          total={inputSteps.length}
          current={stepNum - 1}
          label={t(`${step.key}_label`)}
          hint={timeHint}
        />
      }
      saveIndicator={
        <span className="inline-flex items-center gap-1.5">
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {t("autosave_indicator")}
        </span>
      }
      reassurance={<ReassuranceColumn name={name} t={t} />}
    >
      <form action={saveTeacherStepAction}>
        <input type="hidden" name="learnerId" value={learner.id} />
        <input type="hidden" name="step" value={stepNum} />
        <QuestionCard
          eyebrow={t(`${step.key}_label`)}
          title={t(`${step.key}_header`, { name })}
          helper={t(`${step.key}_helper`)}
          tag={isLast ? t("review_label") : undefined}
          error={errorMessage}
          actions={
            <AssessmentFooter
              back={
                stepNum > 1 ? (
                  <Link
                    href={`/teacher/learners/${learner.id}/assessment?step=${stepNum - 1}`}
                    className={ASSESSMENT_BACK_CLASS}
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M19 12H5" />
                      <path d="m12 19-7-7 7-7" />
                    </svg>
                    {t("back")}
                  </Link>
                ) : (
                  <Link
                    href={`/teacher/learners/${learner.id}/assessment/intro`}
                    className={ASSESSMENT_BACK_CLASS}
                  >
                    {t("back")}
                  </Link>
                )
              }
              saveExit={
                <Link href={`/teacher/learners/${learner.id}`} className={ASSESSMENT_GHOST_CLASS}>
                  {t("save_exit")}
                </Link>
              }
              primaryLabel={isLast ? t("to_review") : t("continue")}
            />
          }
        >
          <div className="flex flex-col gap-6">{renderSection(sectionId, draft, name, t)}</div>
        </QuestionCard>
      </form>
    </AssessmentShell>
  );
}
