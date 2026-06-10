/**
 * Sprint 10: Parent reports redesign — calm summary cards.
 *
 * Surfaces per-learner: a weekly metric strip, the most-recent
 * plain-language summaries, IEP-supports-used count, and a quick
 * link into the learner page. Designed for non-technical parents —
 * no spreadsheets, no jargon.
 *
 * Sprint 13: Upgraded flat FloatingMetricCard numbers to KpiCard with
 * optional signed deltas and inline sparklines wherever history exists.
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { InsightChip, GlassCard, EmptyState } from "@aivo/ui";
import { KpiCard } from "@aivo/ui/chart";
import { PARENT_NAV } from "@/components/layout/role-shells";
import {
  getIEPForLearner,
  getMasteryMap,
  listLearnersForParent,
  listLessonRunsForLearner,
  listParentLessonSummaries,
  listSubjects,
} from "@/lib/db/repos";
import {
  buildKpiAriaLabel,
  computeDeltaPct,
  computeMetricHistory,
  splitIntoPeriods,
} from "@/lib/analytics/trend-compute";

export default async function Page() {
  const session = await requirePageRole(["parent"]);
  const t = await getTranslations("parent.reports");
  const learners = await listLearnersForParent(session.userId, session.tenantId);
  const subjectMap = new Map((await listSubjects()).map((s) => [s.id, s]));

  // Period boundary: 30 days ago
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const priorStart = new Date(thirtyDaysAgo);
  priorStart.setDate(priorStart.getDate() - 30);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <header className="flex flex-col gap-2 mb-6">
        <p className="iw-label text-iw-text-muted">{t("eyebrow")}</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-iw-text-strong">{t("title")}</h1>
        <p className="text-sm md:text-base text-iw-text-muted max-w-2xl">
          A plain-language view of each learner's last few sessions. Numbers are starting points,
          not scores — AIVO uses them to plan calm, just-right lessons.
        </p>
      </header>

      {learners.length === 0 ? (
        <div className="rounded-iw-card-lg bg-white border border-iw-border p-6">
          <EmptyState title={t("no_learners")} body={t("no_learners_body")} />
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {await Promise.all(
            learners.map(async (l) => {
              const summaries = listParentLessonSummaries(l.id, session.tenantId).slice(0, 6);
              const runs = await listLessonRunsForLearner(l.id, session.tenantId);
              const completed = runs.filter((r) => r.status === "completed");
              const completedCount = completed.length;
              const { skillMasteries } = await getMasteryMap(l.id, session.tenantId);
              const overallAvg =
                skillMasteries.length === 0
                  ? 0
                  : skillMasteries.reduce((a, m) => a + m.score, 0) / skillMasteries.length;
              const iep = await getIEPForLearner(l.id, session.tenantId);
              const supportsCount = iep?.acceptedAccommodations?.length ?? 0;

              // --- Trend data: completed lessons ---
              const { current: recentCompleted, prior: priorCompleted } = splitIntoPeriods(
                completed,
                thirtyDaysAgo,
              );
              const completedDelta = computeDeltaPct(
                recentCompleted.length,
                priorCompleted.length,
              );
              const lessonsSeries = computeMetricHistory(
                completed,
                (b) => b.length,
                "week",
                12,
              );

              // --- Trend data: lesson engagement (last 30 days vs prior 30) ---
              // Proxy mastery trend via completed run counts: more completed runs = improving engagement
              const completedLessonsDelta =
                priorCompleted.length > 0
                  ? computeDeltaPct(recentCompleted.length, priorCompleted.length)
                  : null;

              return (
                <section key={l.id} className="flex flex-col gap-4">
                  <header className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h2 className="text-xl font-semibold text-iw-text-strong">{l.displayName}</h2>
                      <p className="text-sm text-iw-text-muted">
                        {completedCount} lesson{completedCount === 1 ? "" : "s"} completed ·{" "}
                        {runs.length} total
                      </p>
                    </div>
                    <Link
                      href={`/parent/learners/${l.id}`}
                      className="inline-flex items-center gap-1.5 rounded-iw-control px-3 py-1.5 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-sunken)]"
                    >
                      {t("open_learner")}
                    </Link>
                  </header>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KpiCard
                      label="Overall mastery"
                      value={`${Math.round(overallAvg * 100)}%`}
                      deltaPct={completedLessonsDelta ?? undefined}
                      periodLabel={completedLessonsDelta != null ? t("period_label_30d") : undefined}
                      series={lessonsSeries.length > 1 ? lessonsSeries : undefined}
                      seriesTone={overallAvg >= 0.65 ? "mastery" : "info"}
                      ariaLabel={buildKpiAriaLabel(
                        "Overall mastery",
                        `${Math.round(overallAvg * 100)}%`,
                        completedLessonsDelta,
                        completedLessonsDelta != null ? t("period_label_30d") : undefined,
                      )}
                    />
                    <KpiCard
                      label="Lessons completed"
                      value={`${completedCount}`}
                      deltaPct={completedDelta ?? undefined}
                      periodLabel={completedDelta != null ? t("period_label_30d") : undefined}
                      series={lessonsSeries.length > 1 ? lessonsSeries : undefined}
                      seriesTone="brand"
                      ariaLabel={buildKpiAriaLabel(
                        "Lessons completed",
                        `${completedCount}`,
                        completedDelta,
                        completedDelta != null ? t("period_label_30d") : undefined,
                      )}
                    />
                    <KpiCard
                      label="Skills tracked"
                      value={`${skillMasteries.length}`}
                      periodLabel={t("period_label_all_time")}
                      seriesTone="info"
                      ariaLabel={buildKpiAriaLabel(
                        "Skills tracked",
                        `${skillMasteries.length}`,
                        null,
                        t("period_label_all_time"),
                      )}
                    />
                    <KpiCard
                      label="IEP supports"
                      value={supportsCount > 0 ? `${supportsCount} on` : "None on file"}
                      periodLabel={iep?.confirmedAt ? "Active" : "Optional"}
                      seriesTone={iep?.confirmedAt ? "success" : "brand"}
                      ariaLabel={buildKpiAriaLabel(
                        "IEP supports",
                        supportsCount > 0 ? `${supportsCount} active` : "none on file",
                      )}
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <h3 className="text-base font-semibold text-iw-text-strong">
                      {t("recent_lessons")}
                    </h3>
                    {summaries.length === 0 ? (
                      <p className="rounded-iw-card-lg bg-white border border-iw-border p-5 text-sm text-iw-text-muted">
                        No completed lessons yet for {l.displayName}.
                      </p>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {summaries.map((s) => (
                          <GlassCard key={s.lessonRunId} elevation="raised" density="comfortable">
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
            }),
          )}
        </div>
      )}
    </AppShell>
  );
}
