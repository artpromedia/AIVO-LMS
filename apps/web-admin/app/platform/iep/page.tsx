import { requirePlatformPage } from "@aivo/admin-auth";
import { getIepProfilesReview, listIepEvaluations } from "@aivo/admin-api/iep";
import { AdminCard, AdminMetricCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDate, formatDateTime } from "@/components/admin-format";

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
      eyebrow="Platform"
      title="IEP oversight"
      description="Special-education evaluation pipeline and IEP annual-review compliance, read from the live IEP tables."
    >
      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <AdminMetricCard label="Evaluations" value={total} />
        <AdminMetricCard label="Submitted" value={queue.counts.submitted ?? 0} />
        <AdminMetricCard label="Decided" value={decided} />
        <AdminMetricCard label="Reviews overdue" value={review.reviewDue} />
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
                    <span className="admin-status">{evaluation.status}</span>
                  </td>
                  <td className="text-sm">{evaluation.decisionEligible ?? "—"}</td>
                  <td className="text-sm">{formatDateTime(evaluation.submittedAt)}</td>
                  <td className="text-sm">{formatDateTime(evaluation.decidedAt)}</td>
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
                  <td className="text-sm font-bold text-red-700">{formatDate(profile.reviewDate)}</td>
                  <td className="text-sm">{profile.revisionCounter}</td>
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
