/**
 * Sprint 10: Parent reports redesign — calm summary cards.
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { RoleHomeScaffold } from "@/components/layout/RoleHomeScaffold";
import { FloatingMetricCard, InsightChip, GlassCard, EmptyState } from "@aivo/ui";
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
  const t = await getTranslations("parent.reports");
  const learners = await listLearnersForParent(session.userId, session.tenantId);
  const subjectMap = new Map((await listSubjects()).map((s) => [s.id, s]));

  const learnerReports = await Promise.all(
    learners.map(async (learner) => {
      const summaries = listParentLessonSummaries(learner.id, session.tenantId).slice(0, 6);
      const runs = await listLessonRunsForLearner(learner.id, session.tenantId);
      const completed = runs.filter((r) => r.status === "completed").length;
      const { skillMasteries } = await getMasteryMap(learner.id, session.tenantId);
      const overallAvg =
        skillMasteries.length === 0
          ? 0
          : skillMasteries.reduce((a, mastery) => a + mastery.score, 0) / skillMasteries.length;
      const iep = await getIEPForLearner(learner.id, session.tenantId);
      const supportsCount = iep?.acceptedAccommodations?.length ?? 0;
      return {
        learner,
        summaries,
        runs,
        completed,
        skillMasteries,
        overallAvg,
        iep,
        supportsCount,
      };
    }),
  );

  const totalCompleted = learnerReports.reduce((acc, report) => acc + report.completed, 0);
  const totalSkills = learnerReports.reduce((acc, report) => acc + report.skillMasteries.length, 0);
  const meanMastery =
    learnerReports.length === 0
      ? 0
      : learnerReports.reduce((acc, report) => acc + report.overallAvg, 0) / learnerReports.length;

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <RoleHomeScaffold
        hero={{
          title: t("title"),
          subheading:
            "A plain-language view of each learner's last few sessions. Numbers are starting points, not scores — AIVO uses them to plan calm, just-right lessons.",
          tone: "calm",
        }}
        kpiStrip={
          <>
            <FloatingMetricCard label="Learners tracked" value={String(learnerReports.length)} tone="info" />
            <FloatingMetricCard
              label="Lessons completed"
              value={String(totalCompleted)}
              description="All learners"
              tone="success"
            />
            <FloatingMetricCard
              label="Mean mastery"
              value={`${Math.round(meanMastery * 100)}%`}
              description={`${totalSkills} skills tracked`}
              tone="neutral"
            />
          </>
        }
        sections={
          learnerReports.length === 0
            ? [
                {
                  title: t("no_learners"),
                  cards: undefined,
                  emptyState: <EmptyState title={t("no_learners")} body={t("no_learners_body")} />,
                },
              ]
            : learnerReports.map((report) => ({
                title: report.learner.displayName,
                cards: (
                  <div className="flex flex-col gap-4">
                    <header className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-sm text-iw-text-muted">
                        {report.completed} lesson{report.completed === 1 ? "" : "s"} completed ·{" "}
                        {report.runs.length} total
                      </p>
                      <Link
                        href={`/parent/learners/${report.learner.id}`}
                        className="inline-flex items-center gap-1.5 rounded-iw-control px-3 py-1.5 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-sunken)]"
                      >
                        {t("open_learner")}
                      </Link>
                    </header>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <FloatingMetricCard
                        label="Overall mastery"
                        value={`${Math.round(report.overallAvg * 100)}%`}
                        description="across subjects"
                        tone={report.overallAvg >= 0.65 ? "success" : "info"}
                      />
                      <FloatingMetricCard
                        label="Lessons completed"
                        value={`${report.completed}`}
                        description="all time"
                        tone="neutral"
                      />
                      <FloatingMetricCard
                        label="Skills tracked"
                        value={`${report.skillMasteries.length}`}
                        description="from baseline"
                        tone="info"
                      />
                      <FloatingMetricCard
                        label="IEP supports"
                        value={report.supportsCount > 0 ? `${report.supportsCount} on` : "None on file"}
                        description={report.iep?.confirmedAt ? "Active" : "Optional"}
                        tone={report.iep?.confirmedAt ? "success" : "neutral"}
                      />
                    </div>

                    <div className="flex flex-col gap-3">
                      <h3 className="text-base font-semibold text-iw-text-strong">{t("recent_lessons")}</h3>
                      {report.summaries.length === 0 ? (
                        <p className="rounded-iw-card-lg bg-white border border-iw-border p-5 text-sm text-iw-text-muted">
                          No completed lessons yet for {report.learner.displayName}.
                        </p>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {report.summaries.map((summary) => (
                            <GlassCard key={summary.lessonRunId} elevation="raised" density="comfortable">
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-semibold text-iw-text-strong leading-snug">
                                  {summary.headline}
                                </p>
                                <InsightChip tone="primary" size="sm">
                                  {subjectMap.get(summary.subjectId)?.name ?? "Subject"}
                                </InsightChip>
                              </div>
                              <p className="mt-2 text-sm text-iw-text-muted leading-relaxed">
                                {summary.highlights.recommendedNext}
                              </p>
                            </GlassCard>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ),
              }))
        }
      />
    </AppShell>
  );
}
