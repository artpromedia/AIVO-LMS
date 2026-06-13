/**
 * Sprint C-07 — Teacher assessment ENTRY screen.
 *
 * The up-front-honesty landing: "Under 10 minutes. Autosaves as you go."
 * plus exactly what AIVO does with the input and what the family sees.
 * One click from here into the wizard. If the teacher already submitted,
 * we acknowledge it and offer an updated read instead of restarting cold.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AssessmentShell, QuestionCard, AssessmentFooter, ASSESSMENT_BACK_CLASS } from "@aivo/ui";
import {
  getLearner,
  teacherCanAccessLearner,
  getOrCreateTeacherAssessmentDraft,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

function clockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function saveIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function sparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}

function lockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default async function TeacherAssessmentIntro({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["teacher"]);
  const t = await getTranslations("teacher.learner_assessment");
  const { learnerId } = await params;
  if (!(await teacherCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();
  const name = learner.displayName;

  const draft = await getOrCreateTeacherAssessmentDraft(learnerId, session.tenantId, session.userId);
  const hasAnyAnswers = Object.values(draft.answers ?? {}).some(
    (v) => v && Object.keys(v).length > 0,
  );
  const alreadySubmitted = Boolean(draft.submittedAt);

  const points: Array<{ icon: React.ReactNode; label: string; body: string }> = [
    { icon: clockIcon(), label: t("entry_point_time_label"), body: t("entry_point_time_body") },
    {
      icon: saveIcon(),
      label: t("entry_point_autosave_label"),
      body: t("entry_point_autosave_body"),
    },
    {
      icon: sparkIcon(),
      label: t("entry_point_use_label"),
      body: t("entry_point_use_body", { name }),
    },
    {
      icon: lockIcon(),
      label: t("entry_point_privacy_label"),
      body: t("entry_point_privacy_body"),
    },
  ];

  const primaryHref = `/teacher/learners/${learner.id}/assessment?step=1`;
  const primaryLabel = alreadySubmitted
    ? t("entry_update")
    : hasAnyAnswers
      ? t("entry_resume")
      : t("entry_start");

  return (
    <AssessmentShell eyebrow={t("entry_eyebrow")}>
      <QuestionCard
        eyebrow={t("entry_eyebrow")}
        title={alreadySubmitted ? t("entry_already_submitted_title", { name }) : t("entry_title", { name })}
        helper={alreadySubmitted ? t("entry_already_submitted_body", { name }) : t("entry_subtitle")}
        actions={
          <AssessmentFooter
            back={
              <Link href={`/teacher/learners/${learner.id}`} className={ASSESSMENT_BACK_CLASS}>
                {t("entry_back_to_learner")}
              </Link>
            }
            primary={
              <Link
                href={primaryHref}
                className="inline-flex items-center gap-2 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110 active:brightness-95 shadow-[0_2px_6px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.18)] focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)] focus:ring-offset-2 focus:ring-offset-white"
              >
                {primaryLabel}
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
                  <path d="M5 12h14" />
                  <path d="m13 5 7 7-7 7" />
                </svg>
              </Link>
            }
          />
        }
      >
        <ul className="grid gap-3 sm:grid-cols-2" aria-label={t("entry_eyebrow")}>
          {points.map((p, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-iw-card border border-iw-border bg-white p-4"
            >
              <span
                className="shrink-0 w-9 h-9 rounded-iw-control flex items-center justify-center bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-sensory-primary)]"
                aria-hidden="true"
              >
                {p.icon}
              </span>
              <span className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-semibold text-iw-text-strong">{p.label}</span>
                <span className="text-xs text-iw-text-muted leading-relaxed">{p.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </QuestionCard>
    </AssessmentShell>
  );
}
