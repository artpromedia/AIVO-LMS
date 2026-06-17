/**
 * State 3 — Review & submit for the teacher "Classroom insights" assessment.
 *
 * A circular completion ring + a per-section recap (questions answered, an
 * Edit deep-link back into the wizard, a complete/needs-attention badge), then
 * the client submit island (live timer + green submit → completion). The
 * submit POST is unchanged, so the contribution signal — assessment-svc system
 * of record + family-svc mirror + `contribution.submitted` audit — keeps the
 * parent "Contributed" badge and brain-clone collaborator fold working.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import {
  getLearner,
  teacherCanAccessLearner,
  getOrCreateTeacherAssessmentDraft,
} from "@/lib/db/repos";
import { TEACHER_ROLE_LABELS } from "@/lib/validators/teacher-assessment";
import {
  TEACHER_ASSESSMENT_SECTIONS,
  TEACHER_ASSESSMENT_TOTAL_QUESTIONS,
  requiredQuestionCount,
  withName,
} from "@/lib/teacher/assessment-content";
import type { TeacherAssessmentDraft } from "@/lib/db/types";
import {
  AssessmentBreadcrumb,
  CircularProgress,
  CheckIcon,
  EditIcon,
  gradeBandLabel,
} from "@/components/teacher/assessment/shared";
import { TeacherAssessmentSubmit } from "../teacher-assessment-submit";

export const dynamic = "force-dynamic";

function answeredCount(section: { id: string; questions: { id: string; type: string }[] }, draft: TeacherAssessmentDraft): number {
  const data = ((draft.answers ?? {})[section.id as keyof typeof draft.answers] ?? {}) as Record<
    string,
    unknown
  >;
  return section.questions.reduce((n, q) => {
    const v = data[q.id];
    const has = Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim().length > 0;
    return has ? n + 1 : n;
  }, 0);
}

function requiredAnswered(section: { id: string; questions: { id: string; optional?: boolean }[] }, draft: TeacherAssessmentDraft): number {
  const data = ((draft.answers ?? {})[section.id as keyof typeof draft.answers] ?? {}) as Record<
    string,
    unknown
  >;
  return section.questions
    .filter((q) => !q.optional)
    .reduce((n, q) => {
      const v = data[q.id];
      const has = Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim().length > 0;
      return has ? n + 1 : n;
    }, 0);
}

export default async function TeacherAssessmentReview({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["teacher"]);
  const { learnerId } = await params;
  if (!(await teacherCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();
  const name = learner.displayName;

  const draft = await getOrCreateTeacherAssessmentDraft(
    learnerId,
    session.tenantId,
    session.userId,
  );

  // Keep TEACHER_ROLE_LABELS referenced so the projection mapping stays
  // discoverable from the review surface (the BFF uses it on submit).
  void TEACHER_ROLE_LABELS;

  const sections = TEACHER_ASSESSMENT_SECTIONS.map((s) => {
    const reqTotal = requiredQuestionCount(s.id);
    const reqDone = requiredAnswered(s, draft);
    return {
      id: s.id,
      title: s.title,
      subtitle: withName(s.subtitle ?? "", name),
      total: s.questions.length,
      answered: answeredCount(s, draft),
      complete: reqTotal === 0 ? answeredCount(s, draft) > 0 : reqDone >= reqTotal,
    };
  });

  const requiredTotal = TEACHER_ASSESSMENT_SECTIONS.reduce(
    (n, s) => n + requiredQuestionCount(s.id),
    0,
  );
  const requiredDone = TEACHER_ASSESSMENT_SECTIONS.reduce(
    (n, s) => n + requiredAnswered(s, draft),
    0,
  );
  const percent = requiredTotal === 0 ? 0 : Math.round((requiredDone / requiredTotal) * 100);
  const allComplete = percent >= 100;

  return (
    <>
      <AssessmentBreadcrumb learnerName={name} />

      <section className="rounded-iw-card border border-iw-border bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-6">
          <CircularProgress percent={percent} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--aivo-sensory-primary)]">
              Review &amp; submit
            </p>
            <h1 className="mt-1 font-iw-display text-2xl font-bold text-iw-text-strong sm:text-3xl">
              Review {name}&rsquo;s assessment
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-iw-text-muted">
              {gradeBandLabel(learner.gradeBand)} ·{" "}
              <span className="tabular-nums">{TEACHER_ASSESSMENT_SECTIONS.length}</span> sections ·{" "}
              <span className="tabular-nums">{TEACHER_ASSESSMENT_TOTAL_QUESTIONS}</span> questions
            </p>
            {allComplete ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--aivo-color-aivoTeal-700)]">
                <CheckIcon className="h-4 w-4" />
                All required responses completed
              </p>
            ) : (
              <p className="mt-2 text-sm text-iw-text-muted">
                <span className="tabular-nums">{requiredDone}</span> of{" "}
                <span className="tabular-nums">{requiredTotal}</span> required questions answered —
                you can still submit, or fill in the gaps below.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-iw-text-muted">
          Your responses
        </h2>
        <ul className="flex flex-col gap-2.5">
          {sections.map((s, i) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-3 rounded-iw-card border border-iw-border bg-white p-4"
            >
              <span
                aria-hidden="true"
                className={[
                  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                  s.complete
                    ? "bg-[var(--aivo-color-aivoTeal-600)] text-white"
                    : "bg-[var(--aivo-color-surface-muted)] text-iw-text-muted",
                ].join(" ")}
              >
                {s.complete ? <CheckIcon className="h-4 w-4" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-iw-text-strong">{s.title}</span>
                <span className="block text-xs text-iw-text-muted">
                  <span className="tabular-nums">{s.answered}</span> of{" "}
                  <span className="tabular-nums">{s.total}</span> questions answered
                </span>
              </span>
              {s.complete ? (
                <span className="inline-flex items-center gap-1 rounded-iw-chip bg-[var(--aivo-color-aivoTeal-50)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--aivo-color-aivoTeal-700)]">
                  <CheckIcon className="h-3 w-3" />
                  Complete
                </span>
              ) : null}
              <Link
                href={`/teacher/learners/${learner.id}/assessment?step=${i + 1}`}
                className="inline-flex items-center gap-1.5 rounded-iw-control px-3 py-1.5 text-sm font-semibold text-[var(--aivo-sensory-primary)] hover:bg-[var(--aivo-color-aivoPurple-50)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aivo-sensory-ringFocus)]"
              >
                <EditIcon className="h-4 w-4" />
                Edit
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-5 rounded-iw-card border border-iw-border bg-white p-6">
        <TeacherAssessmentSubmit
          learnerId={learner.id}
          learnerName={name}
          startedAtMs={draft.startedAtMs}
          backToLearnerHref={`/teacher/learners/${learner.id}`}
          rosterHref="/teacher/learners"
        />
      </section>
    </>
  );
}
