import { requirePageRole } from "@aivo/admin-auth";
import { listIepEvaluations } from "@aivo/admin-api/iep";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";

export default async function DistrictIepPage() {
  // admin-svc scopes district admins to their own tenant automatically.
  const session = await requirePageRole(["district_admin", "platform_admin"]);
  const queue = await listIepEvaluations(session);
  const total = Object.values(queue.counts).reduce((a, b) => a + b, 0);

  return (
    <AdminPageFrame
      eyebrow="District"
      title="IEP evaluations"
      description="Special-education evaluation pipeline for your district, read from the live IEP tables."
    >
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <AdminKpiCard label="Evaluations" value={total} />
        <AdminKpiCard label="Submitted" value={queue.counts.submitted ?? 0} />
        <AdminKpiCard label="Draft" value={queue.counts.draft ?? 0} />
      </section>

      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Learner</th>
                <th>Status</th>
                <th>Eligibility</th>
                <th>Submitted</th>
                <th>Decided</th>
              </tr>
            </thead>
            <tbody>
              {queue.evaluations.map((evaluation) => (
                <tr key={evaluation.id}>
                  <td className="font-mono text-xs">{evaluation.learnerId}</td>
                  <td>
                    <span className="admin-status">{evaluation.status}</span>
                  </td>
                  <td className="text-sm">{evaluation.decisionEligible ?? "—"}</td>
                  <td className="text-sm">{formatDateTime(evaluation.submittedAt)}</td>
                  <td className="text-sm">{formatDateTime(evaluation.decidedAt)}</td>
                </tr>
              ))}
              {queue.evaluations.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={5}>
                    No IEP evaluations on record for this district.
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
