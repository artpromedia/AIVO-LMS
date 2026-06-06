import type { AdminCoupon } from "@aivo/admin-api/billing";

export type CouponDisplayStatus = "active" | "disabled" | "expired" | "exhausted";

/** Derived display status: disabled → expired → exhausted → active. */
export function couponStatus(c: AdminCoupon): CouponDisplayStatus {
  if (!c.active) return "disabled";
  if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()) return "expired";
  if (c.maxRedemptions != null && c.redemptions >= c.maxRedemptions) return "exhausted";
  return "active";
}

/** One-line summary of what the coupon grants, per coupon type. */
export function grantsSummary(c: AdminCoupon): string {
  switch (c.couponType) {
    case "DISCOUNT":
      return `${c.discountPct}% off`;
    case "SUBSCRIPTION":
      return `${c.grantsDurationDays ?? 0} free days${c.grantsPlan ? ` · ${c.grantsPlan}` : ""}`;
    case "PROVISIONING":
      return [
        c.grantsTier,
        c.grantsPlan,
        c.grantsSeatLimit != null ? `${c.grantsSeatLimit} seats` : "unlimited seats",
        c.grantsDurationDays != null ? `${c.grantsDurationDays}d` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    default:
      return "—";
  }
}

export function formatCouponDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

/** Remaining redemptions, or null when uncapped. */
export function remainingRedemptions(c: AdminCoupon): number | null {
  if (c.maxRedemptions == null) return null;
  return Math.max(0, c.maxRedemptions - c.redemptions);
}
