import { requirePlatformPage } from "@aivo/admin-auth";
import { getJobsFreshnessSummary, listJobs } from "@aivo/admin-api/jobs";
import type { AdminFreshnessStatus, AdminJob } from "@aivo/admin-api/jobs";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";

const STATUS_TONE: Record<AdminFreshnessStatus, string> = {
  fresh: "text-emerald-700",
  warning: "text-amber-700",
  stale: "text-red-700",
  never_run: "text-slate-500",
};

const STATUS_LABEL: Record<AdminFreshnessStatus, string> = {
  fresh: "Fresh",
  warning: "Warning",
  stale: "Stale",
  never_run: "Never run",
};

export default async function PlatformJobsPage() {
  const session = await requirePlatformPage("platform:read");
  const [jobs, summary] = await Promise.all([
    listJobs(session),
    getJobsFreshnessSummary(session),
  ]);

  return (
    <AdminPageFrame
      eyebrow="Platform"
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
                <td className={`font-bold ${STATUS_TONE[job.freshnessStatus]}`}>
                  {STATUS_LABEL[job.freshnessStatus]}
                  {job.failed ? <span className="block text-sm text-red-700">failed</span> : null}
                </td>
                <td className="text-sm">
                  {job.lastStatus ? <span className="admin-status">{job.lastStatus}</span> : "—"}
                </td>
                <td className="text-sm">{formatDateTime(job.lastRunAt)}</td>
                <td className="text-sm">{formatDateTime(job.lastFinishedAt)}</td>
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
