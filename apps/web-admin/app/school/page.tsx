import Link from "next/link";
import { requirePageRole, ROLE_LABEL } from "@aivo/admin-auth";
import { getSchoolOverview, type SchoolOverview, type SchoolClassStatus } from "@aivo/admin-api/school";
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
import { BarChart3, BookOpen, CheckCircle2, GraduationCap, Target, Upload } from "lucide-react";
import { BadgeCheck } from "lucide-react";
import { StatusPill, type StatusTone } from "@/components/status-pill";
import { getTenantBrandingById } from "@/lib/tenant-branding";
import { describeSystemHealthFailure } from "../platform/health-state";
import { PanelError } from "../platform/dashboard-panels";
import { currentTermWindow } from "../../lib/report-window";

const DAY_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const IMPORT_TIME = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const pct = (value: number) => `${Math.round(value)}%`;

/** Active-classes status → explicit pill tone + label (statuses aren't in the auto map). */
const CLASS_STATUS: Record<SchoolClassStatus, { tone: StatusTone; label: string }> = {
  on_track: { tone: "positive", label: "On track" },
  at_risk: { tone: "warning", label: "At risk" },
  needs_support: { tone: "danger", label: "Needs support" },
  no_data: { tone: "neutral", label: "No data" },
};

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

/** Recent-import job status → pill (errors downgrade a completed job to a warning). */
function ImportStatus({ status, errors }: { status: string; errors: number }) {
  const normalized = status.toLowerCase();
  if (normalized === "done") {
    return errors > 0 ? (
      <StatusPill status={status} tone="warning" label="Completed with errors" />
    ) : (
      <StatusPill status={status} tone="positive" label="Completed" />
    );
  }
  return <StatusPill status={status} />;
}

export default async function SchoolHomePage() {
  const session = await requirePageRole(["school_admin"]);

  // Each panel fetches and degrades independently, like the platform page.
  const [overviewResult, engagementResult, brandingResult] = await Promise.allSettled([
    getSchoolOverview(session),
    runReport(session, session.tenantId, "attendance_proxy", currentTermWindow()),
    getTenantBrandingById(session.tenantId),
  ]);
  const overview = settle<SchoolOverview>(overviewResult, "school-overview");
  const engagement = settle<AdminReportResult>(engagementResult, "attendance-proxy report");
  const schoolName =
    brandingResult.status === "fulfilled" && brandingResult.value?.displayName
      ? brandingResult.value.displayName
      : null;

  const data = overview.data;
  const classCompletion = data
    ? data.classes
        .filter((c) => c.completionRate !== null)
        .map((c) => ({ label: c.name, value: c.completionRate as number }))
    : [];
  const rosterPct = (value: number) =>
    data && data.rostering.total > 0 ? Math.round((value / data.rostering.total) * 100) : 0;

  return (
    <AdminPageFrame
      eyebrow="School administration"
      title="School Overview"
      description={`Signed in as ${session.displayName} (${ROLE_LABEL[session.role]})${
        schoolName ? ` · ${schoolName}` : ""
      }`}
      action={
        <div className="flex flex-wrap gap-2">
          <Link className="admin-button admin-button-secondary gap-2" href="/school/rostering/import">
            <Upload className="h-4 w-4" aria-hidden="true" />
            Import roster
          </Link>
          <Link className="admin-button gap-2" href="/school/reports">
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            Run report
          </Link>
        </div>
      }
    >
      {/* Row 1 — KPI strip (real counts, 30-day deltas, completion sparkline). */}
      <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {data ? (
          <>
            <AdminKpiCard
              label="Learners"
              testId="school-kpi-learners"
              icon={<GraduationCap className="h-5 w-5" />}
              value={data.counts.learners}
              delta={data.newLearners30d}
              deltaCaption="new in 30 days"
            />
            <AdminKpiCard
              label="Classes"
              testId="school-kpi-classes"
              icon={<BookOpen className="h-5 w-5" />}
              value={data.counts.classes}
              delta={data.newClasses30d}
              deltaCaption="new in 30 days"
            />
            <AdminKpiCard
              label="Completion rate"
              testId="school-kpi-completion"
              icon={<CheckCircle2 className="h-5 w-5" />}
              value={data.completionRate}
              format={pct}
              trend={data.termTrend.map((point) => point.completionRate)}
            />
            <AdminKpiCard
              label="Active IEP goals"
              testId="school-kpi-iep"
              icon={<Target className="h-5 w-5" />}
              value={data.activeIepGoals}
            />
          </>
        ) : (
          <>
            <PanelError compact testId="school-kpi-learners" title="Learners" message={overview.error} />
            <PanelError compact testId="school-kpi-classes" title="Classes" message={overview.error} />
            <PanelError compact testId="school-kpi-completion" title="Completion rate" message={overview.error} />
            <PanelError compact testId="school-kpi-iep" title="Active IEP goals" message={overview.error} />
          </>
        )}
      </section>

      {/* Row 2 — term progress trend + learner support breakdown. */}
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        {data ? (
          <ChartCard
            testId="school-term-trend"
            title="Term progress trend"
            subtitle={`Average lesson completion rate by day over the last ${data.windowDays} days.`}
            srRows={data.termTrend.map((point) => ({
              day: point.day,
              "completion %": point.completionRate,
            }))}
          >
            <AreaTrend
              data={data.termTrend.map((point) => ({
                t: DAY_LABEL.format(new Date(`${point.day}T00:00:00Z`)),
                value: point.completionRate,
              }))}
              title="Term progress"
              description="Average daily lesson completion rate this term"
              label="Completion %"
            />
          </ChartCard>
        ) : (
          <PanelError testId="school-term-trend" title="Term progress trend" message={overview.error} />
        )}
        {data ? (
          data.supportBreakdown.length > 0 ? (
            <ChartCard
              testId="school-support-breakdown"
              title="Learner support breakdown"
              subtitle="Distribution of learners by functioning level."
              aspect={16 / 10}
              srRows={data.supportBreakdown.map((entry) => ({
                "support level": entry.label,
                learners: entry.count,
              }))}
            >
              <DonutBreakdown
                data={data.supportBreakdown.map((entry) => ({
                  label: entry.label,
                  value: entry.count,
                }))}
                title="Learner support breakdown"
                description="Learners grouped by functioning level"
                totalLabel="learners"
              />
            </ChartCard>
          ) : (
            <AdminCard className="p-6" testId="school-support-breakdown">
              <h3 className="admin-h2">Learner support breakdown</h3>
              <p className="mt-4 text-sm text-slate-600">No learners enrolled yet.</p>
            </AdminCard>
          )
        ) : (
          <PanelError testId="school-support-breakdown" title="Learner support breakdown" message={overview.error} />
        )}
      </section>

      {/* Row 3 — class completion + attendance & participation. */}
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        {data ? (
          classCompletion.length > 0 ? (
            <ChartCard
              testId="school-class-completion"
              title="Class completion"
              subtitle="Average lesson completion rate by class."
              srRows={classCompletion.map((row) => ({ class: row.label, "completion %": row.value }))}
            >
              <BarSeries
                data={classCompletion}
                direction="horizontal"
                title="Class completion"
                description="Average lesson completion rate per class"
                valueLabel="Completion %"
              />
            </ChartCard>
          ) : (
            <AdminCard className="p-6" testId="school-class-completion">
              <h3 className="admin-h2">Class completion</h3>
              <p className="mt-4 text-sm text-slate-600">No class completion data yet.</p>
            </AdminCard>
          )
        ) : (
          <PanelError testId="school-class-completion" title="Class completion" message={overview.error} />
        )}
        {engagement.data ? (
          <ChartCard
            testId="school-attendance"
            title="Attendance & participation"
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
              title="Attendance & participation"
              description="Average attendance-proxy rate per week from the school report"
              label="Attendance %"
            />
          </ChartCard>
        ) : (
          <PanelError testId="school-attendance" title="Attendance & participation" message={engagement.error} />
        )}
      </section>

      {/* Row 4 — rostering status + recent imports. */}
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        {data ? (
          <AdminCard className="p-6" testId="school-rostering-status">
            <div className="flex items-center justify-between">
              <h3 className="admin-h2">Rostering status</h3>
              <Link className="text-sm font-semibold text-violet-700 hover:text-violet-800" href="/school/rostering">
                View rostering →
              </Link>
            </div>
            <p className="mt-1 text-sm text-slate-600">Learner roster coverage across your classes.</p>
            <dl className="mt-5 divide-y divide-slate-100">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-sm text-slate-600">Total learners</dt>
                <dd className="admin-tabular text-sm font-semibold">
                  {data.rostering.total.toLocaleString()}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-sm text-slate-600">Rostering complete</dt>
                <dd className="admin-tabular text-sm font-semibold">
                  {data.rostering.complete.toLocaleString()} ({rosterPct(data.rostering.complete)}%)
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-sm text-slate-600">Unassigned learners</dt>
                <dd className="admin-tabular text-sm font-semibold">
                  {data.rostering.unassigned.toLocaleString()} ({rosterPct(data.rostering.unassigned)}%)
                </dd>
              </div>
            </dl>
          </AdminCard>
        ) : (
          <PanelError testId="school-rostering-status" title="Rostering status" message={overview.error} />
        )}
        {data ? (
          <AdminCard className="p-6" testId="school-recent-imports">
            <div className="flex items-center justify-between">
              <h3 className="admin-h2">Recent imports</h3>
              <Link className="text-sm font-semibold text-violet-700 hover:text-violet-800" href="/school/rostering">
                View all →
              </Link>
            </div>
            {data.recentImports.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">No roster imports yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {data.recentImports.map((job) => (
                  <li key={job.jobId} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: "color-mix(in srgb, var(--admin-chart-1) 14%, white)",
                        color: "var(--admin-chart-1)",
                      }}
                      aria-hidden="true"
                    >
                      <BadgeCheck className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">Roster import {job.jobId}</p>
                      <p className="admin-tabular text-xs text-slate-500">
                        {IMPORT_TIME.format(new Date(job.createdAt))} · {job.total.toLocaleString()} records
                      </p>
                    </div>
                    <ImportStatus status={job.status} errors={job.errors} />
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        ) : (
          <PanelError testId="school-recent-imports" title="Recent imports" message={overview.error} />
        )}
      </section>

      {/* Row 5 — active classes table. */}
      <section className="mt-6">
        {data ? (
          <AdminCard className="overflow-hidden" testId="school-active-classes">
            <div className="flex items-center justify-between p-6 pb-0">
              <h3 className="admin-h2">Active classes</h3>
              <Link className="text-sm font-semibold text-violet-700 hover:text-violet-800" href="/school/classes">
                View all classes →
              </Link>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Teacher</th>
                    <th>Learners</th>
                    <th>Avg mastery</th>
                    <th>Assignments due</th>
                    <th>IEP learners</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.classes.map((cls) => (
                    <tr key={cls.id}>
                      <td className="font-semibold">
                        <Link
                          className="text-violet-700 hover:text-violet-800"
                          href={`/school/classes/${cls.id}`}
                        >
                          {cls.name}
                        </Link>
                      </td>
                      <td className="text-sm">{cls.teacherName ?? "—"}</td>
                      <td className="admin-tabular text-sm">{cls.learners.toLocaleString()}</td>
                      <td className="admin-tabular text-sm">
                        {cls.avgMastery === null ? "—" : `${cls.avgMastery}%`}
                      </td>
                      <td className="admin-tabular text-sm">{cls.assignmentsDue.toLocaleString()}</td>
                      <td className="admin-tabular text-sm">{cls.iepLearners.toLocaleString()}</td>
                      <td>
                        <StatusPill
                          status={cls.status}
                          tone={CLASS_STATUS[cls.status].tone}
                          label={CLASS_STATUS[cls.status].label}
                        />
                      </td>
                    </tr>
                  ))}
                  {data.classes.length === 0 ? (
                    <tr>
                      <td className="py-10 text-center text-slate-500" colSpan={7}>
                        No classes found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </AdminCard>
        ) : (
          <PanelError testId="school-active-classes" title="Active classes" message={overview.error} />
        )}
      </section>
    </AdminPageFrame>
  );
}
