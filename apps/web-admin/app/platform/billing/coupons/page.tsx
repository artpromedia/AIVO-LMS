import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import { type AdminCoupon, disableCoupon, listCoupons } from "@aivo/admin-api/billing";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";

function actionError(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "Coupon action failed.";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

/** Derived display status: disabled → expired → exhausted → active. */
function couponStatus(c: AdminCoupon): "active" | "disabled" | "expired" | "exhausted" {
  if (!c.active) return "disabled";
  if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()) return "expired";
  if (c.maxRedemptions != null && c.redemptions >= c.maxRedemptions) return "exhausted";
  return "active";
}

/** One-line summary of what the coupon grants, per coupon type. */
function grantsSummary(c: AdminCoupon): string {
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

async function disableCouponAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const code = String(formData.get("code") || "").trim();
  if (!code) redirect("/platform/billing/coupons?error=Missing%20coupon%20code.");
  try {
    await disableCoupon(session, code);
  } catch (error) {
    redirect(`/platform/billing/coupons?error=${encodeURIComponent(actionError(error))}`);
  }
  redirect(`/platform/billing/coupons?notice=${encodeURIComponent(`Coupon ${code} disabled.`)}`);
}

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
      eyebrow="Platform billing"
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
                      <span className="block">{coupon.code}</span>
                      {coupon.description ? (
                        <span className="text-sm text-slate-500">{coupon.description}</span>
                      ) : null}
                    </td>
                    <td>
                      <span className="admin-status">{coupon.couponType}</span>
                    </td>
                    <td>{grantsSummary(coupon)}</td>
                    <td>
                      {coupon.redemptions}
                      {coupon.maxRedemptions != null ? ` / ${coupon.maxRedemptions}` : ""}
                    </td>
                    <td>
                      <span className={`admin-status admin-status-${status}`}>{status}</span>
                    </td>
                    <td>{formatDate(coupon.expiresAt)}</td>
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
