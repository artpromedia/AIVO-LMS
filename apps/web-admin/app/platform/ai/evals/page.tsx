import Link from "next/link";
import { requirePlatformPage } from "@aivo/admin-auth";
import { type AiEvalRunStatus, listAiEvals } from "@aivo/admin-api/ai-governance";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime, formatPercent } from "@/components/admin-format";

const STATUS_TONE: Record<AiEvalRunStatus, string> = {
  queued: "text-slate-500",
  running: "text-blue-700",
  passed: "text-emerald-700",
  failed: "text-red-700",
};

export default async function AiEvalsPage() {
  const session = await requirePlatformPage("platform:read");
  const runs = await listAiEvals(session);

  const passed = runs.filter((r) => r.status === "passed").length;
  const failed = runs.filter((r) => r.status === "failed").length;

  return (
    <AdminPageFrame
      eyebrow="Platform · Responsible AI"
      title="Eval runs"
      description="Safety, accuracy and bias harness runs from responsible-ai-svc."
      action={
        <Link className="admin-button admin-button-secondary" href="/platform/ai/models">
          Model registry
        </Link>
      }
    >
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <AdminKpiCard label="Runs" value={runs.length} />
        <AdminKpiCard label="Passed" value={passed} />
        <AdminKpiCard label="Failed" value={failed} />
      </section>

      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Harness</th>
                <th>Status</th>
                <th>Safety</th>
                <th>Accuracy</th>
                <th>Bias</th>
                <th>Cases</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="font-bold">
                    <Link
                      className="text-blue-700"
                      href={`/platform/ai/models/${run.modelId}`}
                    >
                      {run.modelId}
                    </Link>
                  </td>
                  <td className="text-sm">{run.harness}</td>
                  <td className={`font-bold uppercase ${STATUS_TONE[run.status]}`}>
                    {run.status}
                  </td>
                  <td className="text-sm">
                    {run.metrics ? formatPercent(run.metrics.safety) : "—"}
                  </td>
                  <td className="text-sm">
                    {run.metrics ? formatPercent(run.metrics.accuracy) : "—"}
                  </td>
                  <td className="text-sm">
                    {run.metrics ? formatPercent(run.metrics.bias) : "—"}
                  </td>
                  <td className="text-sm">{run.caseCount}</td>
                  <td className="text-sm">{formatDateTime(run.startedAt)}</td>
                </tr>
              ))}
              {runs.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={8}>
                    No eval runs recorded.
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
