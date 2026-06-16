/**
 * State 2 — In-progress wizard (server wrapper).
 *
 * Enforces RBAC + roster scope, loads the learner and the autosave draft for
 * THIS teacher, then hands off to the client wizard island (left-rail stepper,
 * progress, per-section autosave, Prev/Next, deep-link `?step`). The draft's
 * `startedAtMs` anchors the time-to-complete telemetry used on submit.
 */
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import {
  getLearner,
  teacherCanAccessLearner,
  getOrCreateTeacherAssessmentDraft,
} from "@/lib/db/repos";
import { TeacherAssessmentWizard } from "./teacher-assessment-wizard";

export const dynamic = "force-dynamic";

export default async function TeacherAssessmentWizardPage({
  params,
  searchParams,
}: {
  params: Promise<{ learnerId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const session = await requirePageRole(["teacher"]);
  const { learnerId } = await params;
  const { step } = await searchParams;
  if (!(await teacherCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  const draft = await getOrCreateTeacherAssessmentDraft(
    learnerId,
    session.tenantId,
    session.userId,
  );

  const initialStep = Number.parseInt(step ?? "1", 10);

  return (
    <TeacherAssessmentWizard
      learnerId={learner.id}
      learnerName={learner.displayName}
      initialStep={Number.isFinite(initialStep) ? initialStep : 1}
      initialAnswers={(draft.answers ?? {}) as Record<string, Record<string, unknown>>}
      introHref={`/teacher/learners/${learner.id}/assessment/intro`}
      reviewHref={`/teacher/learners/${learner.id}/assessment/review`}
    />
  );
}
