import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { scopeTenantsForSession, listInvoicesForTenants } from "@/lib/db/repos";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  paid: "success",
  open: "warning",
  uncollectible: "danger",
  void: "neutral",
  draft: "neutral",
};

function fmtCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const t = await getTranslations("admin.platform_billing_invoices");
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const tenantById = new Map(tenants.map((t) => [t.id, t]));
  const invoices = listInvoicesForTenants(tenants.map((t) => t.id));

  const byStatus = invoices.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, {});

  const totalPaidCents = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amountCents, 0);

  const outstandingCents = invoices
    .filter((i) => i.status === "open" || i.status === "uncollectible")
    .reduce((sum, i) => sum + i.amountCents, 0);

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
        description="Every invoice issued across every tenant."
        actions={
          <Link
            href="/admin/platform/billing/revenue"
            className="text-sm font-medium text-aivo-primary hover:underline"
          >
            {t("link_revenue_summary")}
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            {t("stat_total_invoices")}
          </p>
          <p className="mt-1 font-display text-3xl font-bold">{invoices.length.toLocaleString()}</p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">Paid</p>
          <p className="mt-1 font-display text-3xl font-bold">
            {(byStatus.paid ?? 0).toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-aivo-ink-soft">
            {fmtCurrency(totalPaidCents, "USD")} collected
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">Open</p>
          <p className="mt-1 font-display text-3xl font-bold">
            {(byStatus.open ?? 0).toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-aivo-ink-soft">awaiting payment</p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            {t("stat_outstanding")}
          </p>
          <p className="mt-1 font-display text-3xl font-bold">
            {fmtCurrency(outstandingCents, "USD")}
          </p>
          <p className="mt-1 text-xs text-aivo-ink-soft">open + uncollectible</p>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-aivo-border px-4 py-3 text-sm font-medium">
          {invoices.length.toLocaleString()} {invoices.length === 1 ? "invoice" : "invoices"}
        </div>
        {invoices.length === 0 ? (
          <EmptyState title={t("empty_title")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-aivo-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                <tr>
                  <th className="px-4 py-2">{t("col_number")}</th>
                  <th className="px-4 py-2">{t("col_tenant")}</th>
                  <th className="px-4 py-2 text-right">{t("col_amount")}</th>
                  <th className="px-4 py-2">{t("col_status")}</th>
                  <th className="px-4 py-2">{t("col_period")}</th>
                  <th className="px-4 py-2">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aivo-border">
                {invoices.map((inv) => {
                  const t = tenantById.get(inv.tenantId);
                  return (
                    <tr key={inv.id}>
                      <td className="px-4 py-3 font-mono text-xs">{inv.number}</td>
                      <td className="px-4 py-3">
                        {t ? (
                          <Link
                            href={`/admin/platform/tenants/${inv.tenantId}`}
                            className="font-medium hover:text-aivo-primary"
                          >
                            {t.name}
                          </Link>
                        ) : (
                          <span className="text-aivo-ink-soft">{inv.tenantId}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {fmtCurrency(inv.amountCents, inv.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[inv.status] ?? "neutral"}>{inv.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                        {new Date(inv.periodStartAt).toLocaleDateString()} →{" "}
                        {new Date(inv.periodEndAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                        {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
