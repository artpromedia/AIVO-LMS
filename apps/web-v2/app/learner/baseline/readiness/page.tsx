import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import {
  LearnerBaselineShell,
  PersonalizationChip,
  type PersonalizationVariant,
} from "@aivo/ui";
import {
  getActiveBaselineForLearner,
  getBaselineById,
  getIEPForLearner,
  getLearner,
  getOrCreateParentAssessment,
} from "@/lib/db/repos";

/**
 * /learner/baseline/readiness
 *
 * Calm pre-flight checklist. Lets the learner confirm they're ready
 * before the first question. No timers, no tests-of-the-tools —
 * just three friendly checks: read-aloud, calm environment, breaks
 * are OK.
 */
export default async function BaselineReadinessPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string }>;
}) {
  const session = await requirePageRole(["learner"]);
  if (!session.learnerId) redirect("/learner/home");
  const sp = await searchParams;
  const learner = getLearner(session.learnerId, session.tenantId);
  if (!learner) redirect("/learner/home");

  const baseline = sp.b
    ? getBaselineById(sp.b, session.tenantId)
    : getActiveBaselineForLearner(session.learnerId, session.tenantId);
  if (!baseline || baseline.learnerId !== session.learnerId) {
    redirect("/learner/baseline/subjects");
  }

  const assessment = getOrCreateParentAssessment(session.learnerId, session.tenantId);
  const iep = getIEPForLearner(session.learnerId, session.tenantId);
  const hasReadAloud = Boolean(
    learner.accessibilityDefaults.audioFirst || iep?.extraction?.readingSupport,
  );
  const sensorySensitivities =
    (assessment.answers.sensory as { sensitivities?: string[] })?.sensitivities ?? [];
  const calmMode = sensorySensitivities.length > 0;
  const extendedTime = Boolean(iep?.extraction?.extendedTime);

  const chips: PersonalizationVariant[] = ["parent_assessment", "no_grades"];
  if (iep?.confirmedAt) chips.unshift("iep");
  if (hasReadAloud) chips.push("read_aloud");
  if (calmMode) chips.push("calm_mode");
  if (extendedTime) chips.push("extended_time");

  return (
    <LearnerBaselineShell
      headerLeft={
        <Link
          href="/learner/baseline/subjects"
          className="inline-flex items-center gap-1.5 rounded-iw-control px-3 py-1.5 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-muted)]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          Back
        </Link>
      }
      headerRight={<PersonalizationChip variant="pacing" />}
      status={chips.map((v) => (
        <PersonalizationChip key={v} variant={v} />
      ))}
    >
      <section className="flex flex-col gap-2">
        <p className="iw-label text-iw-text-muted">Step 2 of 3</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-iw-text-strong leading-snug">
          Quick check before we start
        </h1>
        <p className="text-base text-iw-text-muted max-w-2xl">
          Nothing here is a test. Just a few things AIVO turns on so the baseline feels just right.
        </p>
      </section>

      <ul className="grid gap-3 md:grid-cols-2">
        <li className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-2">
          <header className="flex items-center justify-between gap-2">
            <span className="w-10 h-10 rounded-iw-control bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-color-aivoPurple-700)] flex items-center justify-center" aria-hidden="true">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            </span>
            <span
              className={
                hasReadAloud
                  ? "text-xs font-semibold text-[var(--aivo-color-status-success-strong)]"
                  : "text-xs font-semibold text-iw-text-muted"
              }
            >
              {hasReadAloud ? "On" : "You can turn it on per question"}
            </span>
          </header>
          <p className="font-semibold text-iw-text-strong">Read-aloud</p>
          <p className="text-sm text-iw-text-muted leading-relaxed">
            Tap the speaker on any question to hear the words. No one will know — promise.
          </p>
        </li>
        <li className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-2">
          <header className="flex items-center justify-between gap-2">
            <span className="w-10 h-10 rounded-iw-control bg-[var(--aivo-color-aivoTeal-50)] text-[var(--aivo-color-aivoTeal-700)] flex items-center justify-center" aria-hidden="true">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </span>
            <span
              className={
                calmMode
                  ? "text-xs font-semibold text-[var(--aivo-color-status-success-strong)]"
                  : "text-xs font-semibold text-iw-text-muted"
              }
            >
              {calmMode ? "On" : "Default"}
            </span>
          </header>
          <p className="font-semibold text-iw-text-strong">Calm screen</p>
          <p className="text-sm text-iw-text-muted leading-relaxed">
            Soft colors and quiet motion so it's easier to focus. You can change this any time.
          </p>
        </li>
        <li className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-2">
          <header className="flex items-center justify-between gap-2">
            <span className="w-10 h-10 rounded-iw-control bg-[var(--aivo-color-aivoOrange-50)] text-[var(--aivo-color-aivoOrange-700)] flex items-center justify-center" aria-hidden="true">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            </span>
            <span className="text-xs font-semibold text-[var(--aivo-color-status-success-strong)]">
              Always
            </span>
          </header>
          <p className="font-semibold text-iw-text-strong">Breaks are good</p>
          <p className="text-sm text-iw-text-muted leading-relaxed">
            You can pause whenever. AIVO will remember and pick up where you left off.
          </p>
        </li>
        <li className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-2">
          <header className="flex items-center justify-between gap-2">
            <span className="w-10 h-10 rounded-iw-control bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-color-aivoPurple-700)] flex items-center justify-center" aria-hidden="true">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
            <span
              className={
                extendedTime
                  ? "text-xs font-semibold text-[var(--aivo-color-status-success-strong)]"
                  : "text-xs font-semibold text-iw-text-muted"
              }
            >
              {extendedTime ? "On" : "Off"}
            </span>
          </header>
          <p className="font-semibold text-iw-text-strong">Extra time</p>
          <p className="text-sm text-iw-text-muted leading-relaxed">
            There's no clock anyway. Take all the time you need.
          </p>
        </li>
      </ul>

      <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
        <Link
          href="/learner/baseline/why"
          className="inline-flex items-center gap-1.5 rounded-iw-control px-4 py-2.5 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-muted)]"
        >
          Tell me more
        </Link>
        <Link
          href={`/learner/baseline/intro?b=${baseline.id}`}
          className="inline-flex items-center gap-2 rounded-iw-control px-5 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110 shadow-[0_4px_12px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.3)]"
        >
          I'm ready
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m13 5 7 7-7 7" />
          </svg>
        </Link>
      </div>
    </LearnerBaselineShell>
  );
}
