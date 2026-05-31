import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listCoupons } from "@/lib/db/repos";
import type { Coupon, CouponStatus } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<CouponStatus, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  expired: "neutral",
  disabled: "danger",
};

function formatDiscount(d: Coupon["discount"]): string {
  if (d.kind === "percent") return `${d.percentOff}% off`;
  return `$${(d.amountOffCents / 100).toLocaleString()} off`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const t = await getTranslations("admin.platform_billing_coupons");
  const coupons = listCoupons();

  const active = coupons.filter((c) => c.status === "active");
  const totalRedemptions = coupons.reduce((s, c) => s + c.redemptionsCount, 0);
  const expiringSoon = active.filter((c) => {
    if (c.validUntil === null) return false;
    const msUntil = new Date(c.validUntil).getTime() - Date.now();
    // Must still be in the future (msUntil > 0) and within the next 30 days.
    return msUntil > 0 && msUntil <= 30 * 86400_000;
  }).length;

  const stats = [
    { k: "Active codes", v: active.length.toLocaleString() },
    { k: "Total redemptions", v: totalRedemptions.toLocaleString() },
    { k: "Expiring in 30 days", v: expiringSoon.toLocaleString() },
    { k: "All-time codes", v: coupons.length.toLocaleString() },
  ];

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
        description="Promo codes across all plans. Track redemptions, validity windows, and plan eligibility."
      />

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.k} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs uppercase tracking-wide text-aivo-ink-soft">{s.k}</p>
            <p className="mt-2 font-display text-3xl font-semibold">{s.v}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 overflow-hidden p-0">
        {coupons.length === 0 ? (
          <EmptyState
            title={t("empty_title")}
            description="Create your first promo code to attach a discount to family, school, or district plans."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-xs uppercase tracking-wide text-aivo-ink-soft">
              <tr>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">{t("col_discount")}</th>
                <th className="px-4 py-3 text-left">{t("col_applies_to")}</th>
                <th className="px-4 py-3 text-left">{t("col_status")}</th>
                <th className="px-4 py-3 text-right">{t("col_redemptions")}</th>
                <th className="px-4 py-3 text-left">{t("col_valid_window")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aivo-border">
              {coupons.map((c) => {
                const limitLabel =
                  c.maxRedemptions === null
                    ? "unlimited"
                    : `of ${c.maxRedemptions.toLocaleString()}`;
                return (
                  <tr key={c.id} className="hover:bg-aivo-surface-2/40">
                    <td className="px-4 py-3">
                      <div className="font-mono text-sm font-semibold">{c.code}</div>
                      <div className="text-xs text-aivo-ink-soft">{c.name}</div>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatDiscount(c.discount)}</td>
                    <td className="px-4 py-3 text-aivo-ink-soft">
                      {c.appliesToPlans === null ? "All plans" : c.appliesToPlans.join(", ")}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <div>{c.redemptionsCount.toLocaleString()}</div>
                      <div className="text-xs text-aivo-ink-soft">{limitLabel}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                      {formatDate(c.validFrom)} → {formatDate(c.validUntil)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>
  );
}
