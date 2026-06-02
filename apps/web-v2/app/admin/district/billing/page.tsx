import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import {
  getDistrictSummary,
  getDistrictPool,
  listDistrictInvoices,
  getUtilizationSeries,
} from "@/lib/billing/district-pool";
import { SeatPoolCard } from "@/components/admin/billing/seat-pool-card";
import { AllocationMatrix } from "@/components/admin/billing/allocation-matrix";
import { UtilizationChart } from "@/components/admin/billing/utilization-chart";
import { InvoiceTable } from "@/components/admin/billing/invoice-table";

export default async function Page() {
  const session = await requirePageRole(["district_admin"]);
  const t = await getTranslations("admin.district_billing");
  const districtId = session.tenantId;

  const summary = getDistrictSummary(districtId);
  const pool = getDistrictPool(districtId);
  const usageSeries = getUtilizationSeries(districtId, "month");
  const invoices = listDistrictInvoices(districtId).slice(0, 5);

  return (
    <AppShell
      role="district_admin"
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="District admin"
        title={t("title")}
        description="Plan, seat pool, and payment status for your district."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/district/billing/invoices">View all invoices</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/district/billing/allocate">Manage seat allocations</Link>
            </Button>
          </div>
        }
      />

      {/* Seat pool summary */}
      <div className="mb-6">
        <SeatPoolCard
          total={summary.seats.total}
          allocated={summary.seats.allocated}
          used={summary.seats.used}
          unallocated={pool.unallocated}
          status={summary.status}
          renewalDate={summary.renewalDate}
          plan={summary.plan}
          mrrCents={summary.mrrCents}
          arrCents={summary.arrCents}
          currency={summary.currency}
        />
      </div>

      {/* Utilization chart */}
      <Card className="mb-6 p-[var(--aivo-density-card-pad)]">
        <h2 className="mb-4 font-display text-lg font-semibold">Seat utilization (6 months)</h2>
        <UtilizationChart
          series={usageSeries.series}
          granularity={usageSeries.granularity}
          overage={usageSeries.overage}
          hardCap={usageSeries.hardCap}
        />
      </Card>

      {/* Allocation matrix */}
      <div className="mb-6">
        <AllocationMatrix
          allocations={pool.allocations}
          unallocated={pool.unallocated}
          total={pool.pool.total}
        />
      </div>

      {/* Recent invoices */}
      <InvoiceTable
        invoices={invoices}
        districtId={districtId}
        viewAllHref="/admin/district/billing/invoices"
      />
    </AppShell>
  );
}
