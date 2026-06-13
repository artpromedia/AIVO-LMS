import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { AssessmentProgressSummary } from "@/lib/validators/parent-assessment";

/**
 * Welcoming resume card for a part-finished parent assessment (Sprint C-11).
 *
 * Closes §3.1 finding #2 ("resume is correct but invisible"): a parent who left
 * mid-flow now sees proof their work survived and how little is left —
 * "You're 7 of 12 screens in — about 2 minutes left. Your answers are saved." —
 * with a Continue CTA that lands on the first incomplete step.
 *
 * Pure presentational + server-translated; rendered on BOTH the assessment
 * intro and the learner detail page from the same `deriveAssessmentProgress`
 * summary so the counts never disagree. Renders nothing when the parent has not
 * started, or has already finished every screen (the resume affordance only
 * exists while there is something to resume).
 */
export async function AssessmentResumeCard({
  learnerId,
  progress,
  variant = "panel",
}: {
  learnerId: string;
  progress: AssessmentProgressSummary;
  /** "panel" — bordered card for the learner detail page; "inline" — softer
   *  card that sits inside the intro shell's reassurance rhythm. */
  variant?: "panel" | "inline";
}) {
  const t = await getTranslations("parent.learner_assessment_resume");

  // Nothing to resume: not started, or already complete.
  if (!progress.started || progress.nextStep === null) return null;

  const href = `/parent/learners/${learnerId}/assessment?step=${progress.nextStep}`;
  const container =
    variant === "panel"
      ? "rounded-iw-card border border-[var(--aivo-color-aivoPurple-100)] bg-[var(--aivo-color-aivoPurple-50)]/60 p-4"
      : "rounded-iw-card border border-iw-border bg-white p-4";

  return (
    <section className={`flex flex-col gap-3 ${container}`} data-testid="assessment-resume-card">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-iw-text-strong">
          {t("headline", { done: progress.done, total: progress.total })}
        </p>
        <p className="text-xs text-iw-text-muted leading-relaxed">
          {t("minutes_saved", { minutes: progress.minutesLeft })}
        </p>
      </div>
      {/* Soft progress meter so the proof is visible at a glance. */}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--aivo-color-surface-muted)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
        aria-label={t("headline", { done: progress.done, total: progress.total })}
      >
        <div
          className="h-full rounded-full bg-[var(--aivo-sensory-primary)] transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
        />
      </div>
      <Link
        href={href}
        className="inline-flex w-fit items-center gap-2 rounded-iw-control bg-[var(--aivo-sensory-primary)] px-4 py-2 text-sm font-semibold text-white shadow-[0_2px_6px_rgb(from var(--aivo-sensory-primary) r g b / 0.18)] hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)] focus:ring-offset-2 focus:ring-offset-white"
      >
        {t("continue")}
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
    </section>
  );
}
