import Link from "next/link";
import { requirePageRole } from "@aivo/admin-auth";
import { listCoupons } from "@aivo/admin-api/billing";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";
import { StatusPill } from "@/components/status-pill";
import { couponStatus, formatCouponDate, grantsSummary } from "./coupon-display";
import { disableCouponAction } from "./actions";

export default async function CouponsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requirePageRole(["platform_admin"]);
  const params = await searchParams;
  const coupons = await listCoupons(session);

  return (
    <AdminPageFrame
      title="Coupons"
      description="Mint and disable discount, subscription, and provisioning (pilot) coupons. Backed by billing-svc — the single source of truth."
      action={
        <Link className="admin-button" href="/platform/billing/coupons/new">
          New coupon
        </Link>
      }
    >
      {params.notice ? <p className="admin-notice mt-6">{params.notice}</p> : null}
      {params.error ? <p className="admin-error mt-6">{params.error}</p> : null}

      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Type</th>
                <th>Grants</th>
                <th>Redemptions</th>
                <th>Status</th>
                <th>Valid until</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => {
                const status = couponStatus(coupon);
                return (
                  <tr key={coupon.code}>
                    <td className="font-bold">
                      <Link
                        className="text-violet-700 hover:underline"
                        href={`/platform/billing/coupons/${encodeURIComponent(coupon.code)}`}
                      >
                        {coupon.code}
                      </Link>
                      {coupon.description ? (
                        <span className="block text-sm font-normal text-slate-500">
                          {coupon.description}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <StatusPill status={coupon.couponType} />
                    </td>
                    <td>{grantsSummary(coupon)}</td>
                    <td className="tabular-nums">
                      {coupon.redemptions}
                      {coupon.maxRedemptions != null ? ` / ${coupon.maxRedemptions}` : ""}
                    </td>
                    <td>
                      <StatusPill status={status} />
                    </td>
                    <td className="tabular-nums">{formatCouponDate(coupon.expiresAt)}</td>
                    <td>
                      {coupon.active ? (
                        <form action={disableCouponAction}>
                          <input name="code" type="hidden" value={coupon.code} />
                          <button className="admin-action admin-action-danger" type="submit">
                            Disable
                          </button>
                        </form>
                      ) : (
                        <span className="text-sm text-slate-400">Disabled</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {coupons.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={7}>
                    No coupons yet. Create one to get started.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPageFrame>
  );
}
