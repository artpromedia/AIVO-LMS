import Link from "next/link";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminPageFrame } from "@aivo/admin-ui";
import { CouponWizard } from "../coupon-wizard";

export default async function NewCouponPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePageRole(["platform_admin"]);
  const params = await searchParams;

  return (
    <AdminPageFrame
      eyebrow="Platform billing"
      title="New coupon"
      description="Mint a discount, subscription, or provisioning (pilot) coupon. Use a preset to spin up a district or school pilot in under a minute. Validation mirrors billing-svc."
      action={
        <Link className="admin-button admin-button-secondary" href="/platform/billing/coupons">
          Back to coupons
        </Link>
      }
    >
      {params.error ? <p className="admin-error mt-6">{params.error}</p> : null}
      <CouponWizard />
    </AdminPageFrame>
  );
}
