/**
 * Shared, client-safe coupon validation + pilot presets.
 *
 * Lives outside the "use server" action module and the server-only admin-api
 * client so BOTH the client wizard and the server action can import it. The
 * rules mirror billing-svc's coupon validation exactly so a user never reaches
 * a raw 400 from the service.
 */

export type CouponType = "DISCOUNT" | "SUBSCRIPTION" | "PROVISIONING";

export type CouponDraft = {
  code: string;
  description?: string;
  couponType: CouponType;
  discountPct?: number | null;
  maxRedemptions?: number | null;
  expiresAt?: string | null;
  grantsTier?: string | null;
  grantsPlan?: string | null;
  grantsSeatLimit?: number | null;
  grantsDurationDays?: number | null;
};

/** Same pattern billing-svc enforces (already-uppercased code). */
export const COUPON_CODE_PATTERN = /^[A-Z0-9_-]{2,64}$/;

function isWholeInRange(value: unknown, min: number, max: number): boolean {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max;
}

/**
 * Validate a draft, returning a list of human-readable problems (empty = ok).
 * Mirrors billing-svc: code regex, DISCOUNT 1–100, SUBSCRIPTION/PROVISIONING
 * duration 1–3650, PROVISIONING requires tier + plan + duration.
 */
export function validateCouponDraft(draft: CouponDraft): string[] {
  const errors: string[] = [];
  const code = (draft.code ?? "").toUpperCase();

  if (!COUPON_CODE_PATTERN.test(code)) {
    errors.push("Code must be 2–64 characters using A–Z, 0–9, hyphen or underscore.");
  }

  if (draft.couponType === "DISCOUNT") {
    if (!isWholeInRange(draft.discountPct, 1, 100)) {
      errors.push("Discount must be a whole percentage between 1 and 100.");
    }
  } else if (draft.couponType === "SUBSCRIPTION") {
    if (!isWholeInRange(draft.grantsDurationDays, 1, 3650)) {
      errors.push("Free days must be a whole number between 1 and 3650.");
    }
  } else if (draft.couponType === "PROVISIONING") {
    if (!draft.grantsTier) errors.push("Provisioning coupons need a tier.");
    if (!draft.grantsPlan) errors.push("Provisioning coupons need a plan.");
    if (!isWholeInRange(draft.grantsDurationDays, 1, 3650)) {
      errors.push("Provisioning coupons need a duration of 1–3650 days.");
    }
    if (
      draft.grantsSeatLimit != null &&
      String(draft.grantsSeatLimit) !== "" &&
      !isWholeInRange(draft.grantsSeatLimit, 1, 1_000_000)
    ) {
      errors.push("Seat limit must be a positive whole number.");
    }
  }

  if (
    draft.maxRedemptions != null &&
    String(draft.maxRedemptions) !== "" &&
    !isWholeInRange(draft.maxRedemptions, 1, 1_000_000)
  ) {
    errors.push("Max redemptions must be a positive whole number.");
  }

  return errors;
}

export type CouponPreset = {
  id: string;
  label: string;
  description: string;
  /** Fields to prefill; the operator still sets code + (often) seat limit. */
  draft: Partial<CouponDraft>;
};

/**
 * One-click pilot presets. Both provision a B2B seat-licensed tenant; they
 * differ in plan vocabulary and trial length. grantsTier is the single
 * licensed tier (`B2B_SEAT_LICENSED`); the district/school distinction is the
 * plan + duration. Seat limit defaults are starting points the operator tunes.
 */
export const COUPON_PRESETS: CouponPreset[] = [
  {
    id: "district-pilot",
    label: "District pilot",
    description: "Provisioning · district plan · 90-day · seat-limited",
    draft: {
      couponType: "PROVISIONING",
      grantsTier: "B2B_SEAT_LICENSED",
      grantsPlan: "district",
      grantsDurationDays: 90,
      grantsSeatLimit: 500,
      maxRedemptions: 1,
    },
  },
  {
    id: "school-pilot",
    label: "School pilot",
    description: "Provisioning · school plan · 60-day · seat-limited",
    draft: {
      couponType: "PROVISIONING",
      grantsTier: "B2B_SEAT_LICENSED",
      grantsPlan: "school",
      grantsDurationDays: 60,
      grantsSeatLimit: 100,
      maxRedemptions: 1,
    },
  },
];
