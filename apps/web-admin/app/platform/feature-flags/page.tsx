import { requirePlatformPage } from "@aivo/admin-auth";
import { type AdminFeatureFlag, getFeatureFlagInventory } from "@aivo/admin-api/feature-flags";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";

const RISK_TONE: Record<AdminFeatureFlag["riskBand"], string> = {
  low: "text-emerald-700",
  medium: "text-amber-700",
  high: "text-red-700",
};

function FlagTable({ flags }: { flags: AdminFeatureFlag[] }) {
  return (
    <AdminCard className="mt-4 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Flag</th>
              <th>Surface</th>
              <th>Risk</th>
              <th>Default</th>
              <th>State</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((flag) => (
              <tr key={flag.key}>
                <td className="font-bold">
                  <span className="block">{flag.label}</span>
                  <span className="text-sm font-normal text-slate-500">{flag.description}</span>
                </td>
                <td className="text-sm">{flag.surface}</td>
                <td className={`font-bold uppercase ${RISK_TONE[flag.riskBand]}`}>{flag.riskBand}</td>
                <td className="text-sm">{flag.defaultValue ? "on" : "off"}</td>
                <td>
                  <span className="admin-status">{flag.active ? "active" : "inactive"}</span>
                </td>
                <td className="font-mono text-xs text-slate-500">{flag.envVar ?? "—"}</td>
              </tr>
            ))}
            {flags.length === 0 ? (
              <tr>
                <td className="py-10 text-center text-slate-500" colSpan={6}>
                  No flags in this group.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AdminCard>
  );
}

export default async function FeatureFlagsPage() {
  const session = await requirePlatformPage("platform:read");
  const inventory = await getFeatureFlagInventory(session);
  const all = [...inventory.enterprise, ...inventory.sprintPipeline];
  const activeCount = all.filter((flag) => flag.active).length;

  return (
    <AdminPageFrame
      eyebrow="Platform"
      title="Feature flags"
      description="Resolved state of enterprise and sprint-pipeline flags. Environment variables remain the source of truth — this surface is read-only."
    >
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <AdminKpiCard label="Total flags" value={all.length} />
        <AdminKpiCard label="Active" value={activeCount} />
        <AdminKpiCard label="Inactive" value={all.length - activeCount} />
      </section>

      <h2 className="mt-8 text-xl font-black">Enterprise</h2>
      <FlagTable flags={inventory.enterprise} />

      <h2 className="mt-8 text-xl font-black">Sprint pipeline</h2>
      <FlagTable flags={inventory.sprintPipeline} />
    </AdminPageFrame>
  );
}
