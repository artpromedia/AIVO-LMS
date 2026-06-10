import { requirePlatformPage } from "@aivo/admin-auth";
import { getPlatformAiCosts } from "@aivo/admin-api/platform";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatUsd } from "@/components/admin-format";

export default async function AiCostsPage() {
  const session = await requirePlatformPage("platform:read");
  const snapshot = await getPlatformAiCosts(session);
  const { summary, tenants } = snapshot;

  return (
    <AdminPageFrame
      eyebrow="Platform"
      title="AI costs"
      description="Per-tenant AI spend over the last 24 hours, with budget warning and cap signals."
    >
      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <AdminCard className="p-5">
          <p className="text-sm font-semibold text-slate-500">Spend (24h)</p>
          <p className="mt-2 text-3xl font-black">{formatUsd(summary.totalEstimatedCostUsd24h)}</p>
        </AdminCard>
        <AdminKpiCard label="Requests (24h)" value={summary.requestCount24h} />
        <AdminKpiCard label="Warning tenants" value={summary.warningTenants} />
        <AdminKpiCard label="Over cap" value={summary.overCapTenants} />
      </section>

      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Type</th>
                <th>Requests (24h)</th>
                <th>Spend (24h)</th>
                <th>Avg latency</th>
                <th>Budget</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => {
                const budgetState = tenant.budget.exceeded
                  ? "over cap"
                  : tenant.budget.warned
                    ? "warning"
                    : tenant.budget.budgetAvailable
                      ? "ok"
                      : "—";
                return (
                  <tr key={tenant.tenantId}>
                    <td className="font-bold">{tenant.tenantName ?? tenant.tenantId}</td>
                    <td>{tenant.tenantTypeLabel}</td>
                    <td>{tenant.requestCount24h.toLocaleString()}</td>
                    <td>{formatUsd(tenant.estimatedCostUsd24h)}</td>
                    <td className="text-sm">{Math.round(tenant.avgLatencyMs24h)} ms</td>
                    <td>
                      <span className="admin-status">{budgetState}</span>
                    </td>
                  </tr>
                );
              })}
              {tenants.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={6}>
                    No AI activity in the last 24 hours.
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
