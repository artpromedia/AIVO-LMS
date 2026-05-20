import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import {
  LearnerBaselineShell,
  AICompanionHero,
  PersonalizationChip,
  type PersonalizationVariant,
} from "@aivo/ui";
import {
  getIEPForLearner,
  getLearner,
  getOrCreateParentAssessment,
} from "@/lib/db/repos";

/**
 * /learner/baseline/why
 *
 * The "AI personalization explanation" screen from sprint 6. Shown
 * before the learner picks subjects so they understand the baseline
 * is built for them — not a generic quiz. Reads from the parent
 * assessment + IEP to compute the active personalization signals.
 */
export default async function BaselineWhyPage() {
  const session = await requirePageRole(["learner", "parent"]);
  const learnerId =
    session.role === "learner" ? session.learnerId : undefined;
  if (!learnerId) redirect("/learner/home");
  const learner = getLearner(learnerId, session.tenantId);
  if (!learner) redirect("/learner/home");
  const assessment = getOrCreateParentAssessment(learnerId, session.tenantId);
  const iep = getIEPForLearner(learnerId, session.tenantId);

  const chips: PersonalizationVariant[] = ["parent_assessment", "no_grades"];
  if (iep && iep.confirmedAt) chips.unshift("iep");
  if (
    learner.accessibilityDefaults.audioFirst ||
    iep?.extraction?.readingSupport
  ) {
    chips.push("read_aloud");
  }
  const sensorySensitivities = (assessment.answers.sensory as { sensitivities?: string[] })
    ?.sensitivities;
  if (sensorySensitivities && sensorySensitivities.length > 0) chips.push("calm_mode");
  if (iep?.extraction?.extendedTime) chips.push("extended_time");
  chips.push("pacing");

  return (
    <LearnerBaselineShell
      headerLeft={
        <Link
          href="/learner/home"
          className="inline-flex items-center gap-1.5 rounded-iw-control px-3 py-1.5 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-muted)]"
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
          Back home
        </Link>
      }
    >
      <AICompanionHero
        eyebrow="How AIVO got ready for you"
        title={`Hi ${learner.preferredName || learner.firstName} — I made this for you.`}
        body="A grown-up answered a few questions so I'd know how you like to learn. If they shared an IEP, I read the supports too. Here's what I'm doing right now:"
        chips={chips.slice(0, 6).map((v) => (
          <PersonalizationChip key={v} variant={v} />
        ))}
        actions={
          <Link
            href="/learner/baseline/subjects"
            className="inline-flex items-center gap-2 rounded-iw-control px-5 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110 shadow-[0_4px_12px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.3)]"
          >
            Pick where to start
            <svg
              className="w-5 h-5"
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

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-2">
          <span className="w-9 h-9 rounded-iw-control bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-color-aivoPurple-700)] flex items-center justify-center" aria-hidden="true">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </span>
          <h2 className="text-base font-semibold text-iw-text-strong">Made fresh for you</h2>
          <p className="text-sm text-iw-text-muted leading-relaxed">
            Every question is picked just for what your grown-up shared — not from a big shared
            quiz.
          </p>
        </article>
        <article className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-2">
          <span className="w-9 h-9 rounded-iw-control bg-[var(--aivo-color-aivoTeal-50)] text-[var(--aivo-color-aivoTeal-700)] flex items-center justify-center" aria-hidden="true">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </span>
          <h2 className="text-base font-semibold text-iw-text-strong">No grades, no points</h2>
          <p className="text-sm text-iw-text-muted leading-relaxed">
            This isn't a test. AIVO uses what you show to plan calm, just-right lessons.
          </p>
        </article>
        <article className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-2">
          <span className="w-9 h-9 rounded-iw-control bg-[var(--aivo-color-aivoOrange-50)] text-[var(--aivo-color-aivoOrange-700)] flex items-center justify-center" aria-hidden="true">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </span>
          <h2 className="text-base font-semibold text-iw-text-strong">Breaks are good</h2>
          <p className="text-sm text-iw-text-muted leading-relaxed">
            You can pause, take a breath, or stop for today. AIVO will remember where you were.
          </p>
        </article>
      </section>
    </LearnerBaselineShell>
  );
}
