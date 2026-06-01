/**
 * Sprint 16: Family billing redesign — clear, trustworthy, dignified.
 *
 * Three calm sections: current plan + status, plan picker, and
 * recent invoices. Past-due / payment-failed states use warning
 * tone but never red-scare; cancellation is offered without
 * friction so trust is preserved.
 */
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import {
  FloatingMetricCard,
  GlassCard,
  InsightChip,
  EmptyState,
  ReassuranceCard,
} from "@aivo/ui";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { getTenantById } from "@/lib/db/repos";
import { loadParentBillingOverview } from "@/lib/bff/billing-svc";
import { Banner } from "@/components/ui/banner";
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

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const t = await getTranslations("parent.billing");
  const tenant = getTenantById(session.tenantId);
  const { checkout } = await searchParams;
  const { plans, subscription: sub, invoices } = await loadParentBillingOverview(session);
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
        <p className="iw-label text-iw-text-muted">{t("eyebrow")}</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-iw-text-strong">
          {t("title")}
        </h1>
        <p className="text-sm md:text-base text-iw-text-muted max-w-2xl">
          {t("description", { name: tenant?.name ?? t("family_fallback") })}
        </p>
      </header>

      {checkout === "success" ? (
        <div className="mb-6">
          <Banner
            tone="success"
            title={t("checkout.success_title")}
            description={t("checkout.success_body")}
          />
        </div>
      ) : checkout === "cancelled" ? (
        <div className="mb-6">
          <Banner
            tone="info"
            title={t("checkout.cancelled_title")}
            description={t("checkout.cancelled_body")}
          />
        </div>
      ) : null}

      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <FloatingMetricCard
          label={t("plan_label")}
          value={activePlan?.name ?? t("plan_none")}
          description={sub?.status ?? t("plan_pick")}
          tone={sub?.status === "active" ? "success" : "info"}
        />
        <FloatingMetricCard
          label={t("renewal_label")}
          value={
            sub?.currentPeriodEndAt
              ? new Date(sub.currentPeriodEndAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
              : "—"
          }
          description={sub?.cancelAtPeriodEnd ? t("will_not_renew") : t("auto_renews")}
          tone={sub?.cancelAtPeriodEnd ? "warning" : "neutral"}
        />
        <FloatingMetricCard
          label={t("total_label")}
          value={`$${(totalPaidCents / 100).toFixed(2)}`}
          description={t("invoices_count", { count: invoices.length })}
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
            <EmptyState title={t("no_active_plan_title")} body={t("no_active_plan_body")} />
          </GlassCard>
        )}

        <aside className="flex flex-col gap-3">
          <ReassuranceCard
            tone="privacy"
            title={t("reassure_hidden_title")}
            body={t("reassure_hidden_body")}
          />
          <ReassuranceCard
            tone="info"
            title={t("reassure_cancel_title")}
            body={t("reassure_cancel_body")}
          />
        </aside>
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-iw-text-strong">{t("choose_plan")}</h2>
        <SubscribeForm plans={plans} activePlanId={sub?.planId ?? null} />
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-iw-text-strong">{t("recent_invoices")}</h2>
        {invoices.length === 0 ? (
          <GlassCard elevation="raised" density="comfortable">
            <EmptyState
              title={t("no_invoices_title")}
              body={t("no_invoices_body")}
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
