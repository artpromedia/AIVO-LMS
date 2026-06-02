import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listBillingForTenants, scopeTenantsForSession, getTenantById } from "@/lib/db/repos";
import {
  listPlatformRollup,
  mrrCents,
  arrCents,
  getDistrictSummary,
} from "@/lib/billing/district-pool";
import { PlatformRollupTable } from "@/components/admin/billing/platform-rollup-table";

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const t = await getTranslations("admin.platform_billing_overview");
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const accounts = listBillingForTenants(tenants.map((t) => t.id));
  const counts = accounts.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  // District rollup data
  const districtTenants = tenants.filter((t) => t.type === "district");
  const rollupRows = listPlatformRollup(districtTenants.map((t) => t.id));

  // Aggregate MRR/ARR across all districts
  const totalMrr = rollupRows.reduce((sum, r) => sum + r.mrrCents, 0);
  const totalArr = rollupRows.reduce((sum, r) => sum + r.arrCents, 0);

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Billing"
        title={t("title")}
        description="Every billing account on the platform."
      />

      {/* Status summary cards (existing) */}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {["trialing", "active", "past_due", "canceled"].map((k) => (
          <Card key={k} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">{k}</p>
            <p className="mt-1 font-display text-3xl font-bold">{counts[k] ?? 0}</p>
          </Card>
        ))}
      </div>

      {/* MRR / ARR summary cards */}
      {districtTenants.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
              Total MRR (districts)
            </p>
            <p className="mt-1 font-display text-3xl font-bold">{formatMoney(totalMrr)}</p>
          </Card>
          <Card className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
              Total ARR (districts)
            </p>
            <p className="mt-1 font-display text-3xl font-bold">{formatMoney(totalArr)}</p>
          </Card>
          <Card className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
              District tenants
            </p>
            <p className="mt-1 font-display text-3xl font-bold">{districtTenants.length}</p>
          </Card>
        </div>
      )}

      {/* Cross-district rollup table */}
      {districtTenants.length > 0 && (
        <div className="mb-6">
          <PlatformRollupTable rows={rollupRows} />
        </div>
      )}

      {/* All accounts table (existing) */}
      {accounts.length === 0 ? (
        <EmptyState title={t("empty_title")} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-left">
              <tr>
                <th className="p-3">{t("col_tenant")}</th>
                <th className="p-3">Type</th>
                <th className="p-3">Plan</th>
                <th className="p-3">{t("col_status")}</th>
                <th className="p-3">{t("col_created")}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => {
                const tenant = getTenantById(a.tenantId);
                return (
                  <tr key={a.id} className="border-t border-aivo-border">
                    <td className="p-3 font-medium">{tenant?.name ?? a.tenantId}</td>
                    <td className="p-3 text-aivo-ink-soft">{tenant?.type ?? "?"}</td>
                    <td className="p-3 text-aivo-ink-soft">{a.plan}</td>
                    <td className="p-3">
                      <Badge
                        tone={
                          a.status === "active"
                            ? "success"
                            : a.status === "past_due"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {a.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-aivo-ink-soft">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  );
}
