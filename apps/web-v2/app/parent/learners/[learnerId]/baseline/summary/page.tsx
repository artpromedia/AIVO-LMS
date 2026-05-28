import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import {
  AssessmentShell,
  ReassuranceCard,
  InsightChip,
} from "@aivo/ui";
import {
  getActiveBaselineForLearner,
  getIEPForLearner,
  getLearner,
  parentCanAccessLearner,
} from "@/lib/db/repos";

/**
 * /parent/learners/[id]/baseline/summary
 *
 * Sprint 6: the parent/teacher "result handoff" screen. Shows what
 * AIVO learned, where lessons will start per subject, and the
 * personalization signals that stay applied. No grade-style language
 * — every figure is framed as a starting point, not a score.
 */
export default async function BaselineSummaryPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  if (!await parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();
  const baseline = await getActiveBaselineForLearner(learnerId, session.tenantId);
  if (!baseline || baseline.status !== "complete" || !baseline.summary) {
    return (
      <AssessmentShell eyebrow={`Baseline summary for ${learner.displayName}`}>
        <article className="rounded-iw-card-lg bg-white border border-iw-border p-6 md:p-8 flex flex-col gap-4">
          <h1 className="text-2xl font-semibold text-iw-text-strong">
            No completed baseline yet
          </h1>
          <p className="text-sm text-iw-text-muted leading-relaxed">
            Once your learner finishes the baseline, you'll see a calm summary here — including
            which skills lessons will start with and the personalization signals that stay applied.
          </p>
          <Link
            href={`/parent/learners/${learner.id}/baseline`}
            className="self-start inline-flex items-center gap-2 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
          >
            Manage baseline
          </Link>
        </article>
      </AssessmentShell>
    );
  }

  const iep = await getIEPForLearner(learnerId, session.tenantId);
  const ex = iep?.extraction ?? null;
  const summary = baseline.summary;

  return (
    <AssessmentShell
      eyebrow={`Baseline summary for ${learner.displayName}`}
      reassurance={
        <>
          <ReassuranceCard
            tone="info"
            title="Starting points, not scores"
            body="Every figure here is where lessons will start — not how your learner performed. AIVO will adjust as it sees how sessions go."
          />
          {iep?.confirmedAt ? (
            <ReassuranceCard
              tone="safety"
              title="IEP supports stay on"
              body={`AIVO will keep applying the ${
                iep.acceptedAccommodations?.length ?? 0
              } support${(iep.acceptedAccommodations?.length ?? 0) === 1 ? "" : "s"} you confirmed.`}
            />
          ) : (
            <ReassuranceCard
              tone="privacy"
              title="No IEP needed"
              body="AIVO uses your assessment alone for personalization. You can upload an IEP any time."
            />
          )}
        </>
      }
    >
      <header className="flex flex-col gap-2">
        <p className="iw-label text-iw-text-muted">Baseline complete</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-iw-text-strong leading-snug">
          AIVO has what it needs to plan calm, just-right lessons for{" "}
          {learner.preferredName || learner.firstName}.
        </h1>
        <p className="text-sm md:text-base text-iw-text-muted max-w-2xl">
          Here's where lessons will start in each subject. You can revisit this any time from the
          learner's page.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-1">
          <p className="iw-label text-iw-text-muted">Questions answered</p>
          <p className="text-3xl font-semibold text-iw-text-strong tabular-nums">
            {summary.totalAnswered}
            <span className="text-iw-text-muted text-base">/{summary.totalQuestions}</span>
          </p>
          <p className="text-xs text-iw-text-muted leading-relaxed">
            Skipped questions are useful too — they tell AIVO what to ease into slowly.
          </p>
        </article>
        <article className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-1">
          <p className="iw-label text-iw-text-muted">Subjects covered</p>
          <p className="text-3xl font-semibold text-iw-text-strong tabular-nums">
            {summary.perSubject.length}
          </p>
          <p className="text-xs text-iw-text-muted leading-relaxed">
            {summary.perSubject.map((s) => s.subjectName).join(", ")}
          </p>
        </article>
        <article className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-1">
          <p className="iw-label text-iw-text-muted">Personalization</p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <InsightChip tone="primary" size="md">
              Parent assessment
            </InsightChip>
            {iep?.confirmedAt ? (
              <InsightChip tone="accent" size="md">
                IEP · {iep.acceptedAccommodations?.length ?? 0} supports
              </InsightChip>
            ) : null}
            <InsightChip tone="info" size="md">
              Pacing
            </InsightChip>
          </div>
        </article>
      </section>

      <section className="rounded-iw-card-lg bg-white border border-iw-border p-6 flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-iw-text-strong">Where lessons start</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {summary.perSubject.map((s) => (
            <li
              key={s.subjectId}
              className="flex flex-col gap-2 rounded-iw-card border border-iw-border bg-[var(--aivo-color-surface-canvas)]/40 p-4"
            >
              <header className="flex items-center justify-between gap-2">
                <p className="font-semibold text-iw-text-strong">{s.subjectName}</p>
                <InsightChip tone="primary" size="sm">
                  {s.estimate.replaceAll("_", " ")}
                </InsightChip>
              </header>
              <p className="text-xs text-iw-text-muted">
                Answered {s.answered}{s.correct > 0 ? <> · {s.correct} on the first try</> : null}
              </p>
              <div
                className="relative h-1.5 rounded-full bg-[var(--aivo-color-surface-sunken)] overflow-hidden"
                role="img"
                aria-label={`${s.subjectName} accuracy ${Math.round(s.accuracy * 100)} percent`}
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-[var(--aivo-sensory-primary)]"
                  style={{ width: `${Math.max(8, Math.round(s.accuracy * 100))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <article className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-2">
          <p className="iw-label text-iw-text-muted">For you</p>
          <p className="text-sm leading-relaxed text-iw-text-strong">{summary.parentSummary}</p>
        </article>
        <article className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-2">
          <p className="iw-label text-iw-text-muted">What your learner sees</p>
          <p className="text-sm leading-relaxed text-iw-text-strong">
            {summary.learnerSafeSummary}
          </p>
          <p className="text-xs text-iw-text-muted mt-1">
            This is the only version your learner sees — no scores, no clinical language.
          </p>
        </article>
      </section>

      {ex && ex.accommodations.length > 0 ? (
        <section className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-3">
          <p className="iw-label text-iw-text-muted">IEP supports in effect</p>
          <ul className="flex flex-wrap gap-1.5">
            {(iep?.acceptedAccommodations ?? ex.accommodations).slice(0, 12).map((a) => (
              <InsightChip key={a} tone="accent" size="md">
                {a}
              </InsightChip>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href={`/parent/learners/${learner.id}`}
          className="inline-flex items-center gap-2 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
        >
          Back to learner home
        </Link>
        <Link
          href={`/parent/learners/${learner.id}/baseline`}
          className="inline-flex items-center gap-1.5 rounded-iw-control px-4 py-2.5 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-sunken)]"
        >
          Run another baseline
        </Link>
      </div>
    </AssessmentShell>
  );
}
