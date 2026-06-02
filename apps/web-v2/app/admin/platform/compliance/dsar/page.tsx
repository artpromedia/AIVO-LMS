import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listDsars, computeKpis } from "@/lib/compliance/governance-store";
import { DsarQueueTable } from "@/components/admin/compliance/dsar-queue-table";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const t = await getTranslations("admin.platform_compliance_dsar");
  // Platform sees all tenants (tenantScope: undefined)
  const dsars = listDsars();
  const kpis = computeKpis(dsars);

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Compliance"
        title={t("title")}
        description="All DSAR requests across every tenant with SLA tracking."
      />

      {/* KPI summary */}
      <div className="grid gap-3 sm:grid-cols-4 mb-6">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase text-aivo-muted">Open</p>
          <p className="mt-1 font-display text-2xl font-bold">{kpis.open}</p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase text-aivo-muted">Overdue</p>
          <p
            className={`mt-1 font-display text-2xl font-bold ${kpis.overdue > 0 ? "text-aivo-danger" : ""}`}
          >
            {kpis.overdue}
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase text-aivo-muted">Fulfilled</p>
          <p className="mt-1 font-display text-2xl font-bold text-aivo-success">{kpis.fulfilled}</p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase text-aivo-muted">Avg fulfillment</p>
          <p className="mt-1 font-display text-2xl font-bold">
            {kpis.avgFulfillmentHours !== null
              ? `${Math.round(kpis.avgFulfillmentHours / 24)}d`
              : "—"}
          </p>
        </Card>
      </div>

      <DsarQueueTable dsars={dsars} detailBase="/admin/platform/compliance/dsar" />
    </AppShell>
  );
}
