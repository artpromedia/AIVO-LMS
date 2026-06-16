import Link from "next/link";
import { requirePageRole } from "@aivo/admin-auth";
import { getCoupon } from "@aivo/admin-api/billing";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";
import { StatusPill } from "@/components/status-pill";
import {
  couponStatus,
  formatCouponDate,
  grantsSummary,
  remainingRedemptions,
} from "../coupon-display";
import { disableCouponAction } from "../actions";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-3 last:border-0">
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export default async function CouponDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requirePageRole(["platform_admin"]);
  const { code } = await params;
  const sp = await searchParams;
  const coupon = await getCoupon(session, code);

  if (!coupon) {
    return (
      <AdminPageFrame
        title="Coupon not found"
        description={`No coupon with code ${code}.`}
        action={
          <Link className="admin-button admin-button-secondary" href="/platform/billing/coupons">
            Back to coupons
          </Link>
        }
      >
        <p className="admin-error mt-6">That coupon does not exist or has been removed.</p>
      </AdminPageFrame>
    );
  }

  const status = couponStatus(coupon);
  const remaining = remainingRedemptions(coupon);

  return (
    <AdminPageFrame
      title={coupon.code}
      description={coupon.description ?? "Coupon detail and live redemption uptake."}
      action={
        <div className="flex flex-wrap gap-2">
          {coupon.active ? (
            <form action={disableCouponAction}>
              <input name="code" type="hidden" value={coupon.code} />
              <button className="admin-button admin-button-secondary" type="submit">
                Disable coupon
              </button>
            </form>
          ) : null}
          <Link className="admin-button admin-button-secondary" href="/platform/billing/coupons">
            Back to coupons
          </Link>
        </div>
      }
    >
      {sp.notice ? <p className="admin-notice mt-6">{sp.notice}</p> : null}
      {sp.error ? <p className="admin-error mt-6">{sp.error}</p> : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <AdminCard className="p-6">
          <h2 className="text-xl font-black">Pilot uptake</h2>
          <p className="mt-1 text-sm text-slate-500">Live redemption count vs cap.</p>
          <p className="mt-4 text-4xl font-black">
            {coupon.redemptions}
            {coupon.maxRedemptions != null ? (
              <span className="text-2xl text-slate-400"> / {coupon.maxRedemptions}</span>
            ) : null}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {coupon.maxRedemptions == null
              ? "Uncapped — unlimited redemptions."
              : remaining === 0
                ? "Fully redeemed — no remaining redemptions."
                : `${remaining} remaining.`}
          </p>
          <p className="mt-4">
            <StatusPill status={status} />
          </p>
        </AdminCard>

        <AdminCard className="p-6">
          <h2 className="text-xl font-black">Details</h2>
          <div className="mt-4">
            <Row label="Type" value={coupon.couponType} />
            <Row label="Grants" value={grantsSummary(coupon)} />
            <Row
              label="Max redemptions"
              value={coupon.maxRedemptions == null ? "Uncapped" : coupon.maxRedemptions}
            />
            <Row label="Expires" value={formatCouponDate(coupon.expiresAt)} />
            <Row label="Created" value={formatCouponDate(coupon.createdAt)} />
            <Row label="Active" value={coupon.active ? "Yes" : "No"} />
          </div>
        </AdminCard>
      </section>
    </AdminPageFrame>
  );
}
