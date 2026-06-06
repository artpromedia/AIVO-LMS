import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import {
  type AdminCouponType,
  type CreateCouponInput,
  createCoupon,
} from "@aivo/admin-api/billing";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";

function errorMessage(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "Coupon creation failed.";
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) || "").trim();
}

function numOrNull(formData: FormData, key: string): number | null {
  const v = str(formData, key);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function createCouponAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);

  const couponType = str(formData, "couponType") as AdminCouponType;
  const code = str(formData, "code").toUpperCase();
  const input: CreateCouponInput = {
    code,
    description: str(formData, "description") || null,
    couponType,
    maxRedemptions: numOrNull(formData, "maxRedemptions"),
    expiresAt: str(formData, "expiresAt") || null,
  };

  if (couponType === "DISCOUNT") {
    input.discountPct = numOrNull(formData, "discountPct");
  } else if (couponType === "SUBSCRIPTION") {
    input.grantsDurationDays = numOrNull(formData, "grantsDurationDays");
    input.grantsPlan = str(formData, "grantsPlan") || null;
  } else {
    input.grantsTier = str(formData, "grantsTier") || null;
    input.grantsPlan = str(formData, "grantsPlan") || null;
    input.grantsSeatLimit = numOrNull(formData, "grantsSeatLimit");
    input.grantsDurationDays = numOrNull(formData, "grantsDurationDays");
  }

  try {
    await createCoupon(session, input);
  } catch (error) {
    redirect(`/platform/billing/coupons/new?error=${encodeURIComponent(errorMessage(error))}`);
  }
  redirect(`/platform/billing/coupons?notice=${encodeURIComponent(`Coupon ${code} created.`)}`);
}

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
      description="Create a discount, subscription, or provisioning coupon. Validation mirrors billing-svc."
      action={
        <Link className="admin-button admin-button-secondary" href="/platform/billing/coupons">
          Back to coupons
        </Link>
      }
    >
      {params.error ? <p className="admin-error mt-6">{params.error}</p> : null}

      <form action={createCouponAction} className="mt-8 grid gap-6 lg:grid-cols-2">
        <AdminCard className="p-6">
          <h2 className="text-2xl font-black">Coupon basics</h2>
          <label className="admin-label mt-6" htmlFor="code">
            Code
          </label>
          <input
            className="admin-input mt-2"
            id="code"
            name="code"
            required
            pattern="[A-Za-z0-9_\-]{2,64}"
            placeholder="DISTRICT-PILOT-2026"
          />
          <p className="mt-2 text-sm text-slate-500">
            2–64 characters: A–Z, 0–9, hyphen or underscore.
          </p>

          <label className="admin-label mt-5" htmlFor="description">
            Description
          </label>
          <input className="admin-input mt-2" id="description" name="description" />

          <label className="admin-label mt-5" htmlFor="couponType">
            Type
          </label>
          <select
            className="admin-input mt-2"
            id="couponType"
            name="couponType"
            defaultValue="DISCOUNT"
          >
            <option value="DISCOUNT">Discount (% off)</option>
            <option value="SUBSCRIPTION">Subscription (free days)</option>
            <option value="PROVISIONING">Provisioning (pilot: tier + seats)</option>
          </select>

          <label className="admin-label mt-5" htmlFor="maxRedemptions">
            Max redemptions (optional)
          </label>
          <input
            className="admin-input mt-2"
            id="maxRedemptions"
            name="maxRedemptions"
            type="number"
            min={1}
          />

          <label className="admin-label mt-5" htmlFor="expiresAt">
            Expires at (optional)
          </label>
          <input className="admin-input mt-2" id="expiresAt" name="expiresAt" type="date" />
        </AdminCard>

        <AdminCard className="p-6">
          <h2 className="text-2xl font-black">Type-specific fields</h2>
          <p className="mt-2 text-sm text-slate-500">
            Fill the fields for the type you chose. billing-svc validates them on submit.
          </p>

          <label className="admin-label mt-6" htmlFor="discountPct">
            Discount % (DISCOUNT)
          </label>
          <input
            className="admin-input mt-2"
            id="discountPct"
            name="discountPct"
            type="number"
            min={1}
            max={100}
          />

          <label className="admin-label mt-5" htmlFor="grantsDurationDays">
            Free days (SUBSCRIPTION / PROVISIONING)
          </label>
          <input
            className="admin-input mt-2"
            id="grantsDurationDays"
            name="grantsDurationDays"
            type="number"
            min={1}
            max={3650}
          />

          <label className="admin-label mt-5" htmlFor="grantsTier">
            Tier (PROVISIONING)
          </label>
          <input
            className="admin-input mt-2"
            id="grantsTier"
            name="grantsTier"
            placeholder="B2B_SEAT_LICENSED"
          />

          <label className="admin-label mt-5" htmlFor="grantsPlan">
            Plan (SUBSCRIPTION / PROVISIONING)
          </label>
          <input
            className="admin-input mt-2"
            id="grantsPlan"
            name="grantsPlan"
            placeholder="district"
          />

          <label className="admin-label mt-5" htmlFor="grantsSeatLimit">
            Seat limit (PROVISIONING)
          </label>
          <input
            className="admin-input mt-2"
            id="grantsSeatLimit"
            name="grantsSeatLimit"
            type="number"
            min={1}
          />

          <button className="admin-button mt-6 w-full" type="submit">
            Create coupon
          </button>
        </AdminCard>
      </form>
    </AdminPageFrame>
  );
}
