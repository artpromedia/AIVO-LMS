import "server-only";

import { AdminApiError, adminDelete, adminGet, adminPost } from "./client";
import {
  type AdminBillingAccount,
  adminTenantTypeLabel,
  normalizeBillingStatus,
  normalizeTenantKind,
} from "./types";
import type { SessionProfile } from "@aivo/admin-auth/types";

export async function listBillingAccounts(
  session: Pick<SessionProfile, "role">,
): Promise<AdminBillingAccount[]> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    "/api/admin-svc/billing/accounts",
  );
  const accounts = Array.isArray(payload.accounts) ? payload.accounts : [];
  return accounts.map((row) => ({
    id: String((row as Record<string, unknown>).id),
    tenantId: String((row as Record<string, unknown>).tenantId),
    tenantName: (row as Record<string, unknown>).tenantName
      ? String((row as Record<string, unknown>).tenantName)
      : null,
    tenantType: (row as Record<string, unknown>).tenantType
      ? String((row as Record<string, unknown>).tenantType)
      : null,
    tenantKind: normalizeTenantKind(
      (row as Record<string, unknown>).tenantType as string | undefined,
    ),
    tenantTypeLabel: adminTenantTypeLabel(
      (row as Record<string, unknown>).tenantType as string | undefined,
    ),
    plan: String((row as Record<string, unknown>).plan ?? "unknown"),
    status: normalizeBillingStatus((row as Record<string, unknown>).status as string | undefined),
    createdAt: String((row as Record<string, unknown>).createdAt ?? new Date(0).toISOString()),
    updatedAt: (row as Record<string, unknown>).updatedAt
      ? String((row as Record<string, unknown>).updatedAt)
      : null,
    currentPeriodEnd: (row as Record<string, unknown>).currentPeriodEnd
      ? String((row as Record<string, unknown>).currentPeriodEnd)
      : null,
    paymentStatus: (row as Record<string, unknown>).paymentStatus
      ? String((row as Record<string, unknown>).paymentStatus)
      : null,
  }));
}

// ── Trials / conversion report ───────────────────────────────────────────────

export type TrialConversionReport = {
  trialsStartedLast30d: number;
  trialingNow: number;
  trialsEndingIn7d: number;
  convertedLast30d: number;
  conversionRateLast30d: number;
  pilotsStarted: number;
  pilotsConverted: number;
  pilotConversionRate: number;
};

/** Platform trial + pilot-coupon conversion metrics (admin-svc computes it). */
export async function getTrialConversion(
  session: Pick<SessionProfile, "role">,
): Promise<TrialConversionReport> {
  const r = await adminGet<Partial<TrialConversionReport>>(
    session,
    "/api/admin-svc/billing/trials/conversion",
  );
  const n = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    trialsStartedLast30d: n(r.trialsStartedLast30d),
    trialingNow: n(r.trialingNow),
    trialsEndingIn7d: n(r.trialsEndingIn7d),
    convertedLast30d: n(r.convertedLast30d),
    conversionRateLast30d: n(r.conversionRateLast30d),
    pilotsStarted: n(r.pilotsStarted),
    pilotsConverted: n(r.pilotsConverted),
    pilotConversionRate: n(r.pilotConversionRate),
  };
}

// ── Coupons ────────────────────────────────────────────────────────────────
//
// billing-svc (`billing_coupons`) is the canonical store; admin-svc proxies
// CRUD to it (see services/admin-svc/src/routes/billing-coupons.ts). These
// helpers shape the snake_case billing-svc rows into a typed camelCase model
// and translate the canonical error codes into friendly, actionable messages.

export type AdminCouponType = "DISCOUNT" | "SUBSCRIPTION" | "PROVISIONING";

export type AdminCoupon = {
  code: string;
  description: string | null;
  couponType: AdminCouponType;
  /** Percent off for DISCOUNT coupons; 0 for grant-style coupons. */
  discountPct: number;
  maxRedemptions: number | null;
  redemptions: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
  /** PROVISIONING grants. */
  grantsTier: string | null;
  grantsPlan: string | null;
  grantsSeatLimit: number | null;
  /** Free days granted by SUBSCRIPTION / PROVISIONING coupons. */
  grantsDurationDays: number | null;
};

/** Input for creating a coupon, mirroring billing-svc's accepted fields. */
export type CreateCouponInput = {
  code: string;
  description?: string | null;
  couponType: AdminCouponType;
  discountPct?: number | null;
  maxRedemptions?: number | null;
  expiresAt?: string | null;
  grantsTier?: string | null;
  grantsPlan?: string | null;
  grantsSeatLimit?: number | null;
  grantsDurationDays?: number | null;
};

/** Canonical billing-svc coupon error codes → friendly admin-facing copy. */
export const COUPON_ERROR_MESSAGES: Record<string, string> = {
  invalid_code: "Code must be 2–64 characters using A–Z, 0–9, hyphen or underscore.",
  invalid_discount: "Discount must be a whole percentage between 1 and 100.",
  subscription_coupon_missing_duration: "Subscription coupons need a free-days duration (1–3650).",
  provisioning_coupon_missing_fields:
    "Provisioning coupons need a tier, a plan, and a duration in days.",
  duplicate_code: "A coupon with that code already exists. Pick a different code.",
  forbidden: "You don't have permission to manage coupons.",
  missing_bearer_token: "Your session has expired. Sign in again.",
  invalid_token: "Your session has expired. Sign in again.",
};

/** Map a coupon error code to a friendly message, falling back to the raw code. */
export function couponErrorMessage(code: string): string {
  return COUPON_ERROR_MESSAGES[code] ?? code;
}

/**
 * Run a coupon mutation and, on an AdminApiError carrying a known billing-svc
 * error code, rethrow it with a friendly message (preserving status + the
 * original code in `payload`). Callers can surface `error.message` directly.
 */
async function withFriendlyCouponError<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (err) {
    if (err instanceof AdminApiError && err.message in COUPON_ERROR_MESSAGES) {
      throw new AdminApiError(couponErrorMessage(err.message), err.status, {
        code: err.message,
      });
    }
    throw err;
  }
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapCouponRow(row: Record<string, unknown>): AdminCoupon {
  const type = String(row.coupon_type ?? "DISCOUNT").toUpperCase();
  return {
    code: String(row.code),
    description: row.description != null ? String(row.description) : null,
    couponType: (["DISCOUNT", "SUBSCRIPTION", "PROVISIONING"].includes(type)
      ? type
      : "DISCOUNT") as AdminCouponType,
    discountPct: Number(row.discount_pct ?? 0),
    maxRedemptions: toNumberOrNull(row.max_redemptions),
    redemptions: Number(row.redemptions ?? 0),
    active: row.active !== false,
    expiresAt: row.expires_at != null ? String(row.expires_at) : null,
    createdAt: String(row.created_at ?? new Date(0).toISOString()),
    grantsTier: row.grants_tier != null ? String(row.grants_tier) : null,
    grantsPlan: row.grants_plan != null ? String(row.grants_plan) : null,
    grantsSeatLimit: toNumberOrNull(row.grants_seat_limit),
    grantsDurationDays: toNumberOrNull(row.grants_duration_days),
  };
}

/** List every coupon (newest first), backed by billing-svc. */
export async function listCoupons(session: Pick<SessionProfile, "role">): Promise<AdminCoupon[]> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    "/api/admin-svc/billing/coupons",
  );
  const rows = Array.isArray(payload.coupons) ? payload.coupons : [];
  return rows.map((r) => mapCouponRow(r as Record<string, unknown>));
}

/** Fetch a single coupon (with its live redemption count), or null if absent. */
export async function getCoupon(
  session: Pick<SessionProfile, "role">,
  code: string,
): Promise<AdminCoupon | null> {
  try {
    const payload = await adminGet<Record<string, unknown>>(
      session,
      `/api/admin-svc/billing/coupons/${encodeURIComponent(code)}`,
    );
    const row = payload.coupon;
    return row && typeof row === "object" ? mapCouponRow(row as Record<string, unknown>) : null;
  } catch (err) {
    if (err instanceof AdminApiError && err.status === 404) return null;
    throw err;
  }
}

/** Create a coupon via billing-svc; throws AdminApiError with friendly copy. */
export async function createCoupon(
  session: Pick<SessionProfile, "role">,
  input: CreateCouponInput,
): Promise<{ code: string }> {
  return withFriendlyCouponError(async () => {
    const res = await adminPost<{ ok?: boolean; code?: string }>(
      session,
      "/api/admin-svc/billing/coupons",
      input,
    );
    return { code: String(res.code ?? input.code) };
  });
}

/** Disable (soft-delete) a coupon via billing-svc. */
export async function disableCoupon(
  session: Pick<SessionProfile, "role">,
  code: string,
): Promise<{ code: string }> {
  return withFriendlyCouponError(async () => {
    const res = await adminDelete<{ ok?: boolean; code?: string }>(
      session,
      `/api/admin-svc/billing/coupons/${encodeURIComponent(code)}`,
    );
    return { code: String(res.code ?? code) };
  });
}
