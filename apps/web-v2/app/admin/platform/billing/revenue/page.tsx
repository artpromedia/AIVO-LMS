import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import {
  scopeTenantsForSession,
  listInvoicesForTenants,
  listBillingForTenants,
} from "@/lib/db/repos";

function fmtUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function ymKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const tenantIds = tenants.map((t) => t.id);
  const tenantById = new Map(tenants.map((t) => [t.id, t]));
  const invoices = listInvoicesForTenants(tenantIds);
  const billing = listBillingForTenants(tenantIds);

  // Lifetime collected (paid only).
  const paid = invoices.filter((i) => i.status === "paid");
  const lifetimeCents = paid.reduce((s, i) => s + i.amountCents, 0);

  // Monthly bucket of paid invoices, last 12 months.
  const monthly = new Map<string, number>();
  for (const inv of paid) {
    if (!inv.paidAt) continue;
    const k = ymKey(inv.paidAt);
    monthly.set(k, (monthly.get(k) ?? 0) + inv.amountCents);
  }
  const months = Array.from(monthly.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12);
  const maxMonth = Math.max(1, ...months.map(([, v]) => v));

  // Trailing 30 day collected.
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const last30Cents = paid
    .filter((i) => i.paidAt && new Date(i.paidAt).getTime() >= cutoff)
    .reduce((s, i) => s + i.amountCents, 0);

  // Top revenue tenants.
  const byTenant = new Map<string, number>();
  for (const inv of paid) {
    byTenant.set(
      inv.tenantId,
      (byTenant.get(inv.tenantId) ?? 0) + inv.amountCents,
    );
  }
  const topTenants = Array.from(byTenant.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Plan mix.
  const byPlan = billing.reduce<Record<string, number>>((acc, b) => {
    acc[b.plan] = (acc[b.plan] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Billing"
        title="Revenue"
        description="Collected revenue derived from paid invoices across every tenant."
        actions={
          <Link
            href="/admin/platform/billing/invoices"
            className="text-sm font-medium text-aivo-primary hover:underline"
          >
            All invoices →
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            Lifetime collected
          </p>
          <p className="mt-1 font-display text-3xl font-bold">
            {fmtUsd(lifetimeCents)}
          </p>
          <p className="mt-1 text-xs text-aivo-ink-soft">
            {paid.length.toLocaleString()} paid invoices
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            Last 30 days
          </p>
          <p className="mt-1 font-display text-3xl font-bold">
            {fmtUsd(last30Cents)}
          </p>
          <p className="mt-1 text-xs text-aivo-ink-soft">
            rolling window of paid invoices
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            Active subscriptions
          </p>
          <p className="mt-1 font-display text-3xl font-bold">
            {billing.filter((b) => b.status === "active").length.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-aivo-ink-soft">
            {billing.filter((b) => b.status === "past_due").length} past due
          </p>
        </Card>
      </div>

      <Card className="mt-6 p-[var(--aivo-density-card-pad)]">
        <p className="font-display text-lg font-semibold">
          Monthly collected · last 12 months
        </p>
        {months.length === 0 ? (
          <p className="mt-3 text-sm text-aivo-ink-soft">
            No paid invoices yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {months.map(([month, cents]) => {
              const pct = (cents / maxMonth) * 100;
              return (
                <li key={month}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-aivo-ink-soft">
                      {month}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {fmtUsd(cents)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-aivo-border/60">
                    <div
                      className="h-full rounded-full bg-aivo-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold">
            Top revenue tenants
          </p>
          {topTenants.length === 0 ? (
            <EmptyState title="No collections yet" />
          ) : (
            <ul className="mt-3 divide-y divide-aivo-border text-sm">
              {topTenants.map(([tenantId, cents]) => {
                const t = tenantById.get(tenantId);
                return (
                  <li
                    key={tenantId}
                    className="flex items-center justify-between py-2"
                  >
                    {t ? (
                      <Link
                        href={`/admin/platform/tenants/${tenantId}`}
                        className="font-medium hover:text-aivo-primary"
                      >
                        {t.name}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs">{tenantId}</span>
                    )}
                    <span className="font-semibold tabular-nums">
                      {fmtUsd(cents)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold">Plan mix</p>
          <ul className="mt-3 space-y-2 text-sm">
            {["free", "family", "school", "district"].map((plan) => {
              const n = byPlan[plan] ?? 0;
              return (
                <li
                  key={plan}
                  className="flex items-center justify-between rounded-md border border-aivo-border px-3 py-2"
                >
                  <Badge tone="primary">{plan}</Badge>
                  <span className="font-semibold tabular-nums">
                    {n.toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
