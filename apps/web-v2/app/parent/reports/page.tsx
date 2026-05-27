/**
 * Sprint 10: Parent reports redesign — calm summary cards.
 *
 * Surfaces per-learner: a weekly metric strip, the most-recent
 * plain-language summaries, IEP-supports-used count, and a quick
 * link into the learner page. Designed for non-technical parents —
 * no spreadsheets, no jargon.
 */
import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import {
  FloatingMetricCard,
  InsightChip,
  GlassCard,
  EmptyState,
} from "@aivo/ui";
import { PARENT_NAV } from "@/components/layout/role-shells";
import {
  getIEPForLearner,
  getMasteryMap,
  listLearnersForParent,
  listLessonRunsForLearner,
  listParentLessonSummaries,
  listSubjects,
} from "@/lib/db/repos";

export default async function Page() {
  const session = await requirePageRole(["parent"]);
  const learners = await listLearnersForParent(session.userId, session.tenantId);
  const subjectMap = new Map(listSubjects().map((s) => [s.id, s]));

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <header className="flex flex-col gap-2 mb-6">
        <p className="iw-label text-iw-text-muted">Parent</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-iw-text-strong">
          Weekly learning summary
        </h1>
        <p className="text-sm md:text-base text-iw-text-muted max-w-2xl">
          A plain-language view of each learner's last few sessions. Numbers are starting points,
          not scores — AIVO uses them to plan calm, just-right lessons.
        </p>
      </header>

      {learners.length === 0 ? (
        <div className="rounded-iw-card-lg bg-white border border-iw-border p-6">
          <EmptyState
            title="No learners yet"
            body="Add a learner from the home page to begin generating progress reports."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {learners.map((l) => {
            const summaries = listParentLessonSummaries(l.id, session.tenantId).slice(0, 6);
            const runs = listLessonRunsForLearner(l.id, session.tenantId);
            const completed = runs.filter((r) => r.status === "completed").length;
            const { skillMasteries } = getMasteryMap(l.id, session.tenantId);
            const overallAvg =
              skillMasteries.length === 0
                ? 0
                : skillMasteries.reduce((a, m) => a + m.score, 0) / skillMasteries.length;
            const iep = getIEPForLearner(l.id, session.tenantId);
            const supportsCount = iep?.acceptedAccommodations?.length ?? 0;

            return (
              <section key={l.id} className="flex flex-col gap-4">
                <header className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-xl font-semibold text-iw-text-strong">{l.displayName}</h2>
                    <p className="text-sm text-iw-text-muted">
                      {completed} lesson{completed === 1 ? "" : "s"} completed · {runs.length} total
                    </p>
                  </div>
                  <Link
                    href={`/parent/learners/${l.id}`}
                    className="inline-flex items-center gap-1.5 rounded-iw-control px-3 py-1.5 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-sunken)]"
                  >
                    Open learner →
                  </Link>
                </header>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <FloatingMetricCard
                    label="Overall mastery"
                    value={`${Math.round(overallAvg * 100)}%`}
                    description="across subjects"
                    tone={overallAvg >= 0.65 ? "success" : "info"}
                  />
                  <FloatingMetricCard
                    label="Lessons completed"
                    value={`${completed}`}
                    description="all time"
                    tone="neutral"
                  />
                  <FloatingMetricCard
                    label="Skills tracked"
                    value={`${skillMasteries.length}`}
                    description="from baseline"
                    tone="info"
                  />
                  <FloatingMetricCard
                    label="IEP supports"
                    value={supportsCount > 0 ? `${supportsCount} on` : "None on file"}
                    description={iep?.confirmedAt ? "Active" : "Optional"}
                    tone={iep?.confirmedAt ? "success" : "neutral"}
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <h3 className="text-base font-semibold text-iw-text-strong">Recent lessons</h3>
                  {summaries.length === 0 ? (
                    <p className="rounded-iw-card-lg bg-white border border-iw-border p-5 text-sm text-iw-text-muted">
                      No completed lessons yet for {l.displayName}.
                    </p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {summaries.map((s) => (
                        <GlassCard
                          key={s.lessonRunId}
                          elevation="raised"
                          density="comfortable"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-iw-text-strong leading-snug">
                              {s.headline}
                            </p>
                            <InsightChip tone="primary" size="sm">
                              {subjectMap.get(s.subjectId)?.name ?? "Subject"}
                            </InsightChip>
                          </div>
                          <p className="mt-2 text-sm text-iw-text-muted leading-relaxed">
                            {s.highlights.recommendedNext}
                          </p>
                        </GlassCard>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
