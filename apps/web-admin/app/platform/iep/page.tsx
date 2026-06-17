import { requirePlatformPage } from "@aivo/admin-auth";
import { getIepProfilesReview, listIepEvaluations } from "@aivo/admin-api/iep";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDate, formatDateTime } from "@/components/admin-format";
import { StatusPill } from "@/components/status-pill";

export default async function PlatformIepPage() {
  const session = await requirePlatformPage("platform:read");
  const [queue, review] = await Promise.all([
    listIepEvaluations(session),
    getIepProfilesReview(session),
  ]);

  const total = Object.values(queue.counts).reduce((a, b) => a + b, 0);
  const decided = (queue.counts.eligible ?? 0) + (queue.counts.ineligible ?? 0) + (queue.counts.decided ?? 0);

  return (
    <AdminPageFrame
      title="IEP oversight"
      description="Special-education evaluation pipeline and IEP annual-review compliance, read from the live IEP tables."
    >
      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <AdminKpiCard label="Evaluations" value={total} />
        <AdminKpiCard label="Submitted" value={queue.counts.submitted ?? 0} />
        <AdminKpiCard label="Decided" value={decided} />
        <AdminKpiCard label="Reviews overdue" value={review.reviewDue} />
      </section>

      <h2 className="mt-8 text-xl font-black">Evaluation pipeline</h2>
      <AdminCard className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Learner</th>
                <th>Tenant</th>
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
                  <td className="text-sm">{evaluation.tenantId ?? "—"}</td>
                  <td>
                    <StatusPill status={evaluation.status} />
                  </td>
                  <td className="text-sm">{evaluation.decisionEligible ?? "—"}</td>
                  <td className="text-sm tabular-nums">{formatDateTime(evaluation.submittedAt)}</td>
                  <td className="text-sm tabular-nums">{formatDateTime(evaluation.decidedAt)}</td>
                </tr>
              ))}
              {queue.evaluations.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={6}>
                    No IEP evaluations on record.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </AdminCard>

      <h2 className="mt-8 text-xl font-black">
        Annual reviews overdue
        <span className="ml-2 text-sm font-normal text-slate-500">
          IEPs past their review date
        </span>
      </h2>
      <AdminCard className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Learner</th>
                <th>Grade</th>
                <th>Placement</th>
                <th>Lifecycle</th>
                <th>Review due</th>
                <th>Revisions</th>
              </tr>
            </thead>
            <tbody>
              {review.profiles.map((profile) => (
                <tr key={profile.id}>
                  <td className="font-mono text-xs">{profile.learnerId}</td>
                  <td className="text-sm">{profile.gradeLevel ?? "—"}</td>
                  <td className="text-sm">{profile.placement ?? "—"}</td>
                  <td className="text-sm">{profile.lifecycleState}</td>
                  <td className="text-sm font-bold text-red-700 tabular-nums">{formatDate(profile.reviewDate)}</td>
                  <td className="text-sm tabular-nums">{profile.revisionCounter}</td>
                </tr>
              ))}
              {review.profiles.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={6}>
                    No IEPs are past their review date.
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
