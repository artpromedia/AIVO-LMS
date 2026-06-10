import { requirePlatformPage } from "@aivo/admin-auth";
import {
  type RecalibrationRecommendation,
  getBaselineMetrics,
  listBaselineRecalibration,
} from "@aivo/admin-api/baseline";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

const REC_TONE: Record<RecalibrationRecommendation, string> = {
  harder: "text-red-700",
  easier: "text-amber-700",
  ok: "text-slate-500",
};

export default async function BaselineItemsPage() {
  const session = await requirePlatformPage("platform:read");
  const [metrics, recal] = await Promise.all([
    getBaselineMetrics(session, 30),
    listBaselineRecalibration(session, { days: 90, minSample: 20 }),
  ]);
  const { totals } = metrics;

  return (
    <AdminPageFrame
      eyebrow="Platform"
      title="Baseline items"
      description="Item calibration analytics over baseline responses (last 30 days), computed from baseline_item_response_logs."
    >
      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <AdminKpiCard label="Responses" value={totals.responses} />
        <AdminCard className="p-5">
          <p className="text-sm font-semibold text-slate-500">Correct rate</p>
          <p className="mt-2 text-3xl font-black">{pct(totals.correctRate)}</p>
          <p className="mt-1 text-sm text-slate-500">skip {pct(totals.skipRate)}</p>
        </AdminCard>
        <AdminKpiCard label="Learners" value={totals.learners} />
        <AdminKpiCard label="Distinct items" value={totals.items} />
      </section>

      <h2 className="mt-8 text-xl font-black">By difficulty band</h2>
      <AdminCard className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Difficulty</th>
                <th>Responses</th>
                <th>Correct rate</th>
                <th>Skip rate</th>
              </tr>
            </thead>
            <tbody>
              {metrics.byDifficulty.map((row) => (
                <tr key={row.difficulty}>
                  <td className="font-bold">{row.difficulty.replace("_", " ")}</td>
                  <td>{row.responses.toLocaleString()}</td>
                  <td>{pct(row.pCorrect)}</td>
                  <td className="text-sm">{pct(row.pSkipped)}</td>
                </tr>
              ))}
              {metrics.byDifficulty.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={4}>
                    No baseline responses recorded in this window.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </AdminCard>

      <h2 className="mt-8 text-xl font-black">
        Recalibration candidates
        <span className="ml-2 text-sm font-normal text-slate-500">
          last {recal.windowDays}d · ≥{recal.minSample} responses
        </span>
      </h2>
      <AdminCard className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Skill</th>
                <th>Band</th>
                <th>Samples</th>
                <th>p-correct</th>
                <th>Target</th>
                <th>Seed θ</th>
                <th>Suggest</th>
              </tr>
            </thead>
            <tbody>
              {recal.items.map((item) => (
                <tr key={item.itemKey}>
                  <td className="font-mono text-xs">{item.itemKey}</td>
                  <td className="text-sm">{item.skillId}</td>
                  <td className="text-sm">{item.difficulty.replace("_", " ")}</td>
                  <td>{item.samples.toLocaleString()}</td>
                  <td>{pct(item.pCorrect)}</td>
                  <td className="text-sm">{pct(item.targetPCorrect)}</td>
                  <td className="text-sm">{item.seedTheta.toFixed(2)}</td>
                  <td className={`font-bold uppercase ${REC_TONE[item.recommendation]}`}>
                    {item.recommendation === "ok" ? "—" : `make ${item.recommendation}`}
                  </td>
                </tr>
              ))}
              {recal.items.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={8}>
                    No items have enough responses to recalibrate yet.
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
