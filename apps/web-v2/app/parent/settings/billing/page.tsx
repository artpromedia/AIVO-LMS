/**
 * Sprint 16: Family billing redesign — clear, trustworthy, dignified.
 *
 * Three calm sections: current plan + status, plan picker, and
 * recent invoices. Past-due / payment-failed states use warning
 * tone but never red-scare; cancellation is offered without
 * friction so trust is preserved.
 */
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import {
  FloatingMetricCard,
  GlassCard,
  InsightChip,
  EmptyState,
  ReassuranceCard,
} from "@aivo/ui";
import { PARENT_NAV } from "@/components/layout/role-shells";
import {
  getActiveSubscriptionForTenant,
  getTenantById,
  listInvoicesForTenant,
  listPlans,
} from "@/lib/db/repos";
import { SubscribeForm, CancelButton } from "./subscribe-form";

const STATUS_TONE: Record<string, "success" | "warning" | "error" | "neutral"> = {
  trialing: "warning",
  active: "success",
  past_due: "error",
  canceled: "neutral",
  paused: "warning",
};

const INV_TONE: Record<string, "success" | "warning" | "error" | "neutral"> = {
  paid: "success",
  open: "warning",
  void: "neutral",
  uncollectible: "error",
};

export default async function Page() {
  const session = await requirePageRole(["parent"]);
  const tenant = getTenantById(session.tenantId);
  const sub = getActiveSubscriptionForTenant(session.tenantId);
  const plans = listPlans("family");
  const invoices = listInvoicesForTenant(session.tenantId);
  const plansById = new Map(plans.map((p) => [p.plan.id, p.plan]));
  const activePlan = sub ? plansById.get(sub.planId) : null;
  const totalPaidCents = invoices
    .filter((i) => i.status === "paid")
    .reduce((acc, i) => acc + i.amountCents, 0);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <header className="flex flex-col gap-2 mb-6">
        <p className="iw-label text-iw-text-muted">Settings · Billing</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-iw-text-strong">
          Family plan & billing
        </h1>
        <p className="text-sm md:text-base text-iw-text-muted max-w-2xl">
          Plan, payment, and invoice history for {tenant?.name ?? "your family"}.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <FloatingMetricCard
          label="Current plan"
          value={activePlan?.name ?? "No plan"}
          description={sub?.status ?? "Pick one to start"}
          tone={sub?.status === "active" ? "success" : "info"}
        />
        <FloatingMetricCard
          label="Next renewal"
          value={
            sub?.currentPeriodEndAt
              ? new Date(sub.currentPeriodEndAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
              : "—"
          }
          description={sub?.cancelAtPeriodEnd ? "Will not renew" : "Auto-renews"}
          tone={sub?.cancelAtPeriodEnd ? "warning" : "neutral"}
        />
        <FloatingMetricCard
          label="Total paid"
          value={`$${(totalPaidCents / 100).toFixed(2)}`}
          description={`${invoices.length} invoice${invoices.length === 1 ? "" : "s"}`}
          tone="neutral"
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr,320px]">
        {sub ? (
          <GlassCard
            elevation="raised"
            density="comfortable"
            title={activePlan?.name ?? sub.planId}
            description={`Billing period ${new Date(sub.currentPeriodStartAt).toLocaleDateString()} – ${new Date(sub.currentPeriodEndAt).toLocaleDateString()}${
              sub.trialEndAt
                ? ` · trial ends ${new Date(sub.trialEndAt).toLocaleDateString()}`
                : ""
            }`}
            actions={
              <InsightChip tone={STATUS_TONE[sub.status] ?? "neutral"} size="md">
                {sub.status.replaceAll("_", " ")}
              </InsightChip>
            }
          >
            <div className="mt-2 border-t border-iw-border pt-4">
              <CancelButton subscriptionId={sub.id} cancelAtPeriodEnd={sub.cancelAtPeriodEnd} />
            </div>
          </GlassCard>
        ) : (
          <GlassCard elevation="raised" density="comfortable">
            <EmptyState title="No active plan" body="Pick a plan below to get started." />
          </GlassCard>
        )}

        <aside className="flex flex-col gap-3">
          <ReassuranceCard
            tone="privacy"
            title="Billing stays out of learner view"
            body="Your learner never sees plan, payment, or invoice surfaces. Even when they switch into your account, billing is hidden."
          />
          <ReassuranceCard
            tone="info"
            title="Cancel any time, no friction"
            body="Cancellation keeps your learning history intact and you'll keep access until the period ends."
          />
        </aside>
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-iw-text-strong">Choose a plan</h2>
        <SubscribeForm plans={plans} activePlanId={sub?.planId ?? null} />
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-iw-text-strong">Recent invoices</h2>
        {invoices.length === 0 ? (
          <GlassCard elevation="raised" density="comfortable">
            <EmptyState
              title="No invoices yet"
              body="Invoices appear here after each billing period closes."
            />
          </GlassCard>
        ) : (
          <GlassCard elevation="raised" density="comfortable" className="overflow-hidden">
            <ul className="divide-y divide-iw-border -mx-1">
              {invoices.map((i) => (
                <li
                  key={i.id}
                  className="px-1 py-3 grid grid-cols-[1fr,auto] gap-2 items-center"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-iw-text-strong tabular-nums">{i.number}</p>
                    <p className="text-xs text-iw-text-muted">
                      {new Date(i.periodStartAt).toLocaleDateString()} –{" "}
                      {new Date(i.periodEndAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right flex flex-col gap-1 items-end">
                    <p className="font-semibold text-iw-text-strong tabular-nums">
                      ${(i.amountCents / 100).toFixed(2)}
                    </p>
                    <InsightChip tone={INV_TONE[i.status] ?? "neutral"} size="sm">
                      {i.status}
                    </InsightChip>
                  </div>
                </li>
              ))}
            </ul>
          </GlassCard>
        )}
      </section>
    </AppShell>
  );
}
