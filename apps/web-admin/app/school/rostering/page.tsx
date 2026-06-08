import Link from "next/link";
import { requirePageRole } from "@aivo/admin-auth";
import { type AdminImportJob, listImportJobs } from "@aivo/admin-api/rostering";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";

const ROSTERING_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

/** Parse the `?jobs=` param (comma-separated job ids) recent imports leave behind. */
function parseJobIds(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function statusLabel(job: AdminImportJob): string {
  switch (job.status) {
    case "done":
      return "Done";
    case "running":
      return "Running";
    case "failed":
      return "Failed";
    default:
      return "Pending";
  }
}

export default async function SchoolRosteringPage({
  searchParams,
}: {
  searchParams: Promise<{ jobs?: string; notice?: string; error?: string }>;
}) {
  const session = await requirePageRole([...ROSTERING_ROLES]);
  const params = await searchParams;
  const jobIds = parseJobIds(params.jobs);
  const jobs = await listImportJobs(session, session.tenantId, jobIds);

  return (
    <AdminPageFrame
      eyebrow="School"
      title="Rostering"
      description="Bulk-import learners from a CSV roster and track recent import jobs."
    >
      {params.notice ? <p className="admin-notice mt-5">{params.notice}</p> : null}
      {params.error ? <p className="admin-error mt-5">{params.error}</p> : null}

      <div className="mt-8 flex flex-wrap gap-2">
        <Link className="admin-action" href="/school/rostering/import">
          Import learners
        </Link>
      </div>

      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Status</th>
                <th>Total</th>
                <th>Created</th>
                <th>Updated</th>
                <th>Skipped</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job: AdminImportJob) => (
                <tr key={job.jobId}>
                  <td className="font-bold">{job.jobId}</td>
                  <td>
                    <span className="admin-status">{statusLabel(job)}</span>
                  </td>
                  <td className="text-sm">{job.summary.total.toLocaleString()}</td>
                  <td className="text-sm">{job.summary.created.toLocaleString()}</td>
                  <td className="text-sm">{job.summary.updated.toLocaleString()}</td>
                  <td className="text-sm">{job.summary.skipped.toLocaleString()}</td>
                </tr>
              ))}
              {jobs.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={6}>
                    No recent import jobs. Start one from “Import learners”.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPageFrame>
  );
}
