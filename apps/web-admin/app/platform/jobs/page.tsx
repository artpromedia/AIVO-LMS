import { requirePlatformPage } from "@aivo/admin-auth";
import { getJobsFreshnessSummary, listJobs } from "@aivo/admin-api/jobs";
import type { AdminFreshnessStatus, AdminJob } from "@aivo/admin-api/jobs";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";
import { StatusPill, type StatusTone } from "@/components/status-pill";

const FRESHNESS_TONE: Record<AdminFreshnessStatus, StatusTone> = {
  fresh: "positive",
  warning: "warning",
  stale: "danger",
  never_run: "neutral",
};

export default async function PlatformJobsPage() {
  const session = await requirePlatformPage("platform:read");
  const [jobs, summary] = await Promise.all([
    listJobs(session),
    getJobsFreshnessSummary(session),
  ]);

  return (
    <AdminPageFrame
      title="Jobs"
      description="Background job registry with freshness status derived from the watchdog ledger."
    >
      <section className="mt-8 grid gap-4 md:grid-cols-5">
        <AdminKpiCard label="Fresh" value={summary.counts.fresh} />
        <AdminKpiCard label="Warning" value={summary.counts.warning} />
        <AdminKpiCard label="Stale" value={summary.counts.stale} />
        <AdminKpiCard label="Never run" value={summary.counts.never_run} />
        <AdminKpiCard label="Failed" value={summary.counts.failed} />
      </section>

      <h2 className="mt-8 text-xl font-black">Registered jobs</h2>
      <JobsTable jobs={jobs} />
    </AdminPageFrame>
  );
}

function JobsTable({ jobs }: { jobs: AdminJob[] }) {
  return (
    <AdminCard className="mt-6 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Job</th>
              <th>Service</th>
              <th>Status</th>
              <th>Last status</th>
              <th>Last run</th>
              <th>Last finished</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.jobName}>
                <td className="font-bold">
                  {job.jobName}
                  {job.unregistered ? (
                    <span className="block text-sm font-normal text-amber-700">unregistered</span>
                  ) : (
                    <span className="block text-sm font-normal text-slate-500">{job.description}</span>
                  )}
                </td>
                <td className="text-sm">{job.service}</td>
                <td>
                  <StatusPill status={job.freshnessStatus} tone={FRESHNESS_TONE[job.freshnessStatus]} />
                  {job.failed ? (
                    <span className="mt-1 block">
                      <StatusPill status="failed" />
                    </span>
                  ) : null}
                </td>
                <td className="text-sm">
                  {job.lastStatus ? <StatusPill status={job.lastStatus} /> : "—"}
                </td>
                <td className="text-sm tabular-nums">{formatDateTime(job.lastRunAt)}</td>
                <td className="text-sm tabular-nums">{formatDateTime(job.lastFinishedAt)}</td>
              </tr>
            ))}
            {jobs.length === 0 ? (
              <tr>
                <td className="py-10 text-center text-slate-500" colSpan={6}>
                  No jobs registered.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AdminCard>
  );
}
