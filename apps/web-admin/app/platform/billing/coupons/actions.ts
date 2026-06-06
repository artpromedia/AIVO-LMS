"use server";

import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import { type CreateCouponInput, createCoupon, disableCoupon } from "@aivo/admin-api/billing";
import { type CouponDraft, validateCouponDraft } from "./coupon-validation";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof AdminApiError ? error.message : fallback;
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

/** Build a typed draft from the wizard form fields. */
function draftFromForm(formData: FormData): CouponDraft {
  const couponType = str(formData, "couponType") as CouponDraft["couponType"];
  return {
    code: str(formData, "code").toUpperCase(),
    description: str(formData, "description") || undefined,
    couponType,
    discountPct: numOrNull(formData, "discountPct"),
    maxRedemptions: numOrNull(formData, "maxRedemptions"),
    expiresAt: str(formData, "expiresAt") || null,
    grantsTier: str(formData, "grantsTier") || null,
    grantsPlan: str(formData, "grantsPlan") || null,
    grantsSeatLimit: numOrNull(formData, "grantsSeatLimit"),
    grantsDurationDays: numOrNull(formData, "grantsDurationDays"),
  };
}

export async function createCouponAction(formData: FormData): Promise<void> {
  const session = await requirePageRole(["platform_admin"]);
  const draft = draftFromForm(formData);

  // Server-side validation mirrors billing-svc exactly so the user never hits
  // a raw 400 even if the client validation was bypassed.
  const problems = validateCouponDraft(draft);
  if (problems.length > 0) {
    redirect(`/platform/billing/coupons/new?error=${encodeURIComponent(problems[0])}`);
  }

  const input: CreateCouponInput = {
    code: draft.code,
    description: draft.description ?? null,
    couponType: draft.couponType,
    maxRedemptions: draft.maxRedemptions ?? null,
    expiresAt: draft.expiresAt ?? null,
  };
  if (draft.couponType === "DISCOUNT") {
    input.discountPct = draft.discountPct ?? null;
  } else if (draft.couponType === "SUBSCRIPTION") {
    input.grantsDurationDays = draft.grantsDurationDays ?? null;
    input.grantsPlan = draft.grantsPlan ?? null;
  } else {
    input.grantsTier = draft.grantsTier ?? null;
    input.grantsPlan = draft.grantsPlan ?? null;
    input.grantsSeatLimit = draft.grantsSeatLimit ?? null;
    input.grantsDurationDays = draft.grantsDurationDays ?? null;
  }

  try {
    await createCoupon(session, input);
  } catch (error) {
    redirect(
      `/platform/billing/coupons/new?error=${encodeURIComponent(errorMessage(error, "Coupon creation failed."))}`,
    );
  }
  redirect(
    `/platform/billing/coupons?notice=${encodeURIComponent(`Coupon ${draft.code} created.`)}`,
  );
}

export async function disableCouponAction(formData: FormData): Promise<void> {
  const session = await requirePageRole(["platform_admin"]);
  const code = str(formData, "code");
  if (!code) redirect("/platform/billing/coupons?error=Missing%20coupon%20code.");
  try {
    await disableCoupon(session, code);
  } catch (error) {
    redirect(
      `/platform/billing/coupons?error=${encodeURIComponent(errorMessage(error, "Coupon action failed."))}`,
    );
  }
  redirect(`/platform/billing/coupons?notice=${encodeURIComponent(`Coupon ${code} disabled.`)}`);
}
