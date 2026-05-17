import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PARENT_NAV } from "@/components/layout/role-shells";
import {
  getActiveSubscriptionForTenant,
  getTenantById,
  listInvoicesForTenant,
  listPlans,
} from "@/lib/db/repos";
import { CreditCard } from "lucide-react";
import { SubscribeForm, CancelButton } from "./subscribe-form";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  trialing: "warning",
  active: "success",
  past_due: "danger",
  canceled: "neutral",
  paused: "warning",
};

const INV_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  paid: "success",
  open: "warning",
  void: "neutral",
  uncollectible: "danger",
};

export default async function Page() {
  const session = await requirePageRole(["parent"]);
  const tenant = getTenantById(session.tenantId);
  const sub = getActiveSubscriptionForTenant(session.tenantId);
  const plans = listPlans("family");
  const invoices = listInvoicesForTenant(session.tenantId);
  const plansById = new Map(plans.map((p) => [p.plan.id, p.plan]));

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Settings"
        title="Billing"
        description={`Plan and payment status for ${tenant?.name ?? "your family"}.`}
      />

      {sub ? (
        <Card className="mb-6 max-w-3xl p-6">
          <div className="flex flex-wrap items-center gap-3">
            <CreditCard className="h-5 w-5 text-aivo-primary" />
            <div>
              <p className="font-display text-lg font-semibold">
                {plansById.get(sub.planId)?.name ?? sub.planId}
              </p>
              <p className="text-sm text-aivo-ink-soft">
                Period {new Date(sub.currentPeriodStartAt).toLocaleDateString()} – {new Date(sub.currentPeriodEndAt).toLocaleDateString()}
                {sub.trialEndAt ? ` · trial ends ${new Date(sub.trialEndAt).toLocaleDateString()}` : ""}
              </p>
            </div>
            <Badge tone={STATUS_TONE[sub.status] ?? "neutral"} className="ml-auto">
              {sub.status}
            </Badge>
          </div>
          <div className="mt-4 border-t border-aivo-border pt-4">
            <CancelButton subscriptionId={sub.id} cancelAtPeriodEnd={sub.cancelAtPeriodEnd} />
          </div>
        </Card>
      ) : (
        <EmptyState title="No active plan" description="Pick a plan below to get started." />
      )}

      <h2 className="mb-3 font-display text-lg font-semibold">Choose a plan</h2>
      <SubscribeForm plans={plans} activePlanId={sub?.planId ?? null} />

      <h2 className="mb-3 mt-8 font-display text-lg font-semibold">Recent invoices</h2>
      {invoices.length === 0 ? (
        <EmptyState title="No invoices yet" description="Invoices appear here after each billing period closes." />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-left">
              <tr>
                <th className="p-3">Number</th>
                <th className="p-3">Period</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-t border-aivo-border">
                  <td className="p-3 font-medium">{i.number}</td>
                  <td className="p-3 text-aivo-ink-soft">
                    {new Date(i.periodStartAt).toLocaleDateString()} – {new Date(i.periodEndAt).toLocaleDateString()}
                  </td>
                  <td className="p-3">${(i.amountCents / 100).toFixed(2)}</td>
                  <td className="p-3">
                    <Badge tone={INV_TONE[i.status] ?? "neutral"}>{i.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  );
}
