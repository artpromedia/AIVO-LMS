import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import {
  AssessmentShell,
  QuestionCard,
  AssessmentFooter,
  ASSESSMENT_BACK_CLASS,
  ReassuranceCard,
} from "@aivo/ui";
import { getLearner, getOrCreateParentAssessment, parentCanAccessLearner } from "@/lib/db/repos";
import {
  WIZARD_STEPS,
  deriveAssessmentProgress,
  type AssessmentSectionId,
} from "@/lib/validators/parent-assessment";
import { AssessmentResumeCard } from "../assessment-resume-card";

// The total number of calm screens drives the time estimate + screen-count copy
// so they stay honest if the wizard is ever re-segmented again (Sprint C-11
// split step 10 → 12 screens). ~1 screen ≈ 1 minute, rounded to a friendly
// bucket of 5 minutes for the up-front estimate.
const TOTAL_SCREENS = WIZARD_STEPS.length;
const EST_MINUTES = Math.max(5, Math.round(TOTAL_SCREENS / 5) * 5);

/** Spell the screen count for the calm copy ("Twelve calm screens") rather than
 *  a bare numeral. Falls back to the numeral outside the wizard's small range so
 *  it can never read wrong. */
const SCREEN_WORDS: Record<number, string> = {
  10: "Ten",
  11: "Eleven",
  12: "Twelve",
  13: "Thirteen",
  14: "Fourteen",
};
const SCREENS_WORD = SCREEN_WORDS[TOTAL_SCREENS] ?? String(TOTAL_SCREENS);

const ROAD_AHEAD = [
  {
    icon: (
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
    ),
    labelKey: "road_time_label",
    bodyKey: "road_time_body",
  },
  {
    icon: (
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
    ),
    labelKey: "road_private_label",
    bodyKey: "road_private_body",
  },
  {
    icon: (
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
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    labelKey: "road_iep_label",
    bodyKey: "road_iep_body",
  },
  {
    icon: (
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
        <circle cx="12" cy="12" r="3" />
        <path d="M3 12a9 9 0 0 1 9-9" />
        <path d="M21 12a9 9 0 0 1-9 9" />
      </svg>
    ),
    labelKey: "road_baseline_label",
    bodyKey: "road_baseline_body",
  },
];

export default async function AssessmentIntro({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const t = await getTranslations("parent.learner_assessment_intro");
  const { learnerId } = await params;
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();
  const assessment = await getOrCreateParentAssessment(learnerId, session.tenantId);
  const progress = deriveAssessmentProgress(
    assessment.answers as Partial<Record<AssessmentSectionId, Record<string, unknown>>>,
  );
  const hasProgress = progress.started;
  // Continue target: the first incomplete step (or step 1 when complete/unstarted).
  const continueStep = progress.nextStep ?? 1;

  return (
    <AssessmentShell
      eyebrow={`Parent assessment for ${learner.displayName}`}
      reassurance={
        <>
          <AssessmentResumeCard learnerId={learner.id} progress={progress} variant="inline" />
          <ReassuranceCard
            tone="privacy"
            title={t("reassurance_privacy_title")}
            body="Stored on your account. Never displayed to your learner or shared with other parents."
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
            link={{ href: "/parent/privacy", label: "How we protect your data →" }}
          />
          <ReassuranceCard
            tone="info"
            title={t("reassurance_no_diagnosis_title")}
            body="Pick whatever feels right. AIVO doesn't need a formal label — only what helps day to day."
          />
        </>
      }
    >
      <QuestionCard
        eyebrow="Get set up"
        title={`Let's set up learning for ${learner.preferredName || learner.firstName}`}
        helper="A few calm questions so AIVO can teach the way your learner thinks, paces, and feels best. Nothing here is graded — it shapes how lessons land."
        actions={
          <AssessmentFooter
            back={
              <Link href={`/parent/learners/${learner.id}`} className={ASSESSMENT_BACK_CLASS}>
                {t("not_now")}
              </Link>
            }
            primary={
              <Link
                href={`/parent/learners/${learner.id}/assessment?step=${continueStep}`}
                className="inline-flex items-center gap-2 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110 shadow-[0_2px_6px_rgb(from var(--aivo-sensory-primary) r g b / 0.18)] focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)] focus:ring-offset-2 focus:ring-offset-white"
              >
                {hasProgress ? "Continue where I left off" : "Start the assessment"}
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
        <ul className="grid gap-3 sm:grid-cols-2">
          {ROAD_AHEAD.map((step) => (
            <li
              key={step.labelKey}
              className="flex items-start gap-3 rounded-iw-card border border-iw-border bg-[var(--aivo-color-surface-canvas)]/40 p-4"
            >
              <span
                className="shrink-0 w-9 h-9 rounded-iw-control flex items-center justify-center bg-[var(--aivo-aivoPurple-50)] text-[var(--aivo-sensory-primary)]"
                aria-hidden="true"
              >
                {step.icon}
              </span>
              <span className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-semibold text-iw-text-strong">
                  {t(step.labelKey, { minutes: EST_MINUTES })}
                </span>
                <span className="text-xs text-iw-text-muted leading-relaxed">
                  {/* en spells the count ("Twelve"); other locales use the
                      numeral {screens} — both vars are passed so every catalog
                      renders without a missing-placeholder error. */}
                  {t(step.bodyKey, { screensWord: SCREENS_WORD, screens: TOTAL_SCREENS })}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </QuestionCard>
    </AssessmentShell>
  );
}
