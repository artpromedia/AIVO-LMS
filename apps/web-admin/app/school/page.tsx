import { requirePageRole } from "@aivo/admin-auth";
import { getSchoolOverview, type SchoolOverview } from "@aivo/admin-api/school";
import { runReport, type AdminReportResult } from "@aivo/admin-api/reports";
import {
  AdminCard,
  AdminKpiCard,
  AdminPageFrame,
  AreaTrend,
  BarSeries,
  ChartCard,
  DonutBreakdown,
} from "@aivo/admin-ui";
import type { AreaTrendPoint } from "@aivo/admin-ui";
import { describeSystemHealthFailure } from "../platform/health-state";
import { PanelError } from "../platform/dashboard-panels";
import { currentTermWindow } from "../../lib/report-window";

const DAY_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const RUN_TIME = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Average the attendance-proxy report (grade × week rows) into one weekly series. */
function engagementSeries(report: AdminReportResult): AreaTrendPoint[] {
  const byWeek = new Map<string, { total: number; count: number }>();
  for (const row of report.rows) {
    const week = String(row.week_start ?? "");
    if (!week) continue;
    const bucket = byWeek.get(week) ?? { total: 0, count: 0 };
    bucket.total += Number(row.attendance_rate_pct ?? 0);
    bucket.count += 1;
    byWeek.set(week, bucket);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, bucket]) => ({
      t: DAY_LABEL.format(new Date(`${week}T00:00:00Z`)),
      value: bucket.count > 0 ? Math.round(bucket.total / bucket.count) : 0,
    }));
}

function settle<T>(
  result: PromiseSettledResult<T>,
  label: string,
): { data: T | null; error: string | null } {
  if (result.status === "fulfilled") return { data: result.value, error: null };
  console.error(`web-admin /school: ${label} read failed`, result.reason);
  return { data: null, error: describeSystemHealthFailure(result.reason) };
}

export default async function SchoolHomePage() {
  const session = await requirePageRole(["school_admin"]);

  // Each panel fetches and degrades independently, like the platform page.
  const [overviewResult, engagementResult] = await Promise.allSettled([
    getSchoolOverview(session),
    runReport(session, session.tenantId, "attendance_proxy", currentTermWindow()),
  ]);
  const overview = settle<SchoolOverview>(overviewResult, "school-overview");
  const engagement = settle<AdminReportResult>(engagementResult, "attendance-proxy report");

  return (
    <AdminPageFrame
      eyebrow="School administration"
      title="School operations"
      description="Live roster, engagement, and class metrics for your school."
    >
      {/* Row 1 — real counts from the school overview read model. */}
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {overview.data ? (
          <>
            <AdminKpiCard
              label="Learners"
              testId="school-kpi-learners"
              value={overview.data.counts.learners}
            />
            <AdminKpiCard
              label="Classes"
              testId="school-kpi-classes"
              value={overview.data.counts.classes}
            />
            <AdminKpiCard
              label="Teachers"
              testId="school-kpi-teachers"
              value={overview.data.counts.teachers}
            />
          </>
        ) : (
          <>
            <PanelError compact testId="school-kpi-learners" title="Learners" message={overview.error} />
            <PanelError compact testId="school-kpi-classes" title="Classes" message={overview.error} />
            <PanelError compact testId="school-kpi-teachers" title="Teachers" message={overview.error} />
          </>
        )}
      </section>

      {/* Row 2 — engagement (real report run) + learners by grade. */}
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        {engagement.data ? (
          <ChartCard
            testId="school-engagement"
            title="Engagement this week"
            subtitle={`${
              engagement.data.estimated ? "Estimated — " : ""
            }attendance proxy by week from the ${engagement.data.reportId} report.`}
            srRows={engagementSeries(engagement.data).map((point) => ({
              week: point.t,
              "attendance %": point.value,
            }))}
          >
            <AreaTrend
              data={engagementSeries(engagement.data)}
              title="Engagement by week"
              description="Average attendance-proxy rate per week from the school report"
              label="Attendance %"
            />
          </ChartCard>
        ) : (
          <PanelError testId="school-engagement" title="Engagement this week" message={engagement.error} />
        )}
        {overview.data ? (
          <ChartCard
            testId="school-grade-mix"
            title="Learners by grade"
            subtitle="Current enrollment grouped by grade level."
            aspect={16 / 10}
            srRows={overview.data.learnersByGrade.map((entry) => ({
              grade: entry.grade,
              learners: entry.count,
            }))}
          >
            <DonutBreakdown
              data={overview.data.learnersByGrade.map((entry) => ({
                label: `Grade ${entry.grade}`,
                value: entry.count,
              }))}
              title="Learners by grade"
              description="Enrolled learners grouped by grade level"
              totalLabel="learners"
            />
          </ChartCard>
        ) : (
          <PanelError testId="school-grade-mix" title="Learners by grade" message={overview.error} />
        )}
      </section>

      {/* Row 3 — class sizes + recent activity. */}
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        {overview.data ? (
          <ChartCard
            testId="school-class-sizes"
            title="Class sizes"
            subtitle="Learners per classroom."
            srRows={overview.data.classSizes.map((cls) => ({
              class: cls.name,
              learners: cls.learners,
            }))}
          >
            <BarSeries
              data={overview.data.classSizes.map((cls) => ({
                label: cls.name,
                value: cls.learners,
              }))}
              title="Class sizes"
              description="Number of learners in each classroom"
              valueLabel="Learners"
            />
          </ChartCard>
        ) : (
          <PanelError testId="school-class-sizes" title="Class sizes" message={overview.error} />
        )}
        {overview.data ? (
          <AdminCard className="p-6" testId="school-recent-activity">
            <h3 className="admin-h2">Recent activity</h3>
            <p className="mt-1 text-sm text-slate-600">
              Latest lesson runs across your school ({overview.data.windowDays}-day window shown in
              the engagement chart).
            </p>
            {overview.data.recent.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">No lesson activity yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Learner</th>
                      <th>Status</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.data.recent.map((run) => (
                      <tr key={run.id}>
                        <td className="font-semibold">{run.learnerName}</td>
                        <td className="text-sm capitalize">{run.status.replace(/_/g, " ")}</td>
                        <td className="admin-tabular text-sm">
                          {RUN_TIME.format(new Date(run.createdAt))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminCard>
        ) : (
          <PanelError testId="school-recent-activity" title="Recent activity" message={overview.error} />
        )}
      </section>
    </AdminPageFrame>
  );
}
