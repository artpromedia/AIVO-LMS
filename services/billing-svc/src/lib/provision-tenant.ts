/**
 * Shared tenant-entitlement provisioning.
 *
 * This is the ONE place that turns a grant (PROVISIONING coupon redeem, or the
 * platform pilot-provision flow) into real entitlement state:
 *   - sets `tenants.licensing_tier` + `tenants.seat_limit`, and
 *   - inserts an `ACTIVE` `subscriptions` row carrying the grant metadata.
 *
 * Both the coupon redeem route and the internal pilot-provision route call this
 * so the money/seat path can never drift between them. The caller owns the
 * transaction (so the entitlement + the coupon-redemption counter commit
 * together) and any idempotency / audit / metrics concerns around it.
 */
import { sql } from "drizzle-orm";

export interface ProvisionTenantInput {
  tenantId: string;
  /** The subscription's `user_id`. Pilot provisioning uses the platform actor. */
  userId: string;
  /** Subscription plan slug (the coupon's `grants_plan`, e.g. "district"). */
  plan: string;
  /** `tenants.licensing_tier` to set (the coupon's `grants_tier`). */
  tier: string;
  /** `tenants.seat_limit` to set (B2B seat cap); null clears the cap. */
  seatLimit: number | null;
  /** Subscription length; `current_period_end = NOW() + durationDays`. */
  durationDays: number;
  /** Source coupon code recorded on the subscription metadata. */
  couponCode: string;
  /** Provenance tag on the subscription metadata: "coupon" | "pilot". */
  provisionedBy: "coupon" | "pilot";
  /** Optional campaign attribution merged into the subscription metadata.
   *  Typed loosely so the redeem path's `SubscriptionAttribution` (interface
   *  without an index signature) and a plain object both spread cleanly. */
  attribution?: object;
}

export interface ProvisionTenantResult {
  /** The freshly-inserted subscription's `current_period_end`. */
  expiresAt: unknown;
}

/**
 * Apply the entitlement inside the caller's transaction. Mirrors the legacy
 * inline PROVISIONING redeem behavior exactly (tier + seat_limit update, then
 * an ACTIVE subscription), returning the new period end via RETURNING so the
 * caller needs no follow-up SELECT.
 */
export async function provisionTenantEntitlement(
  tx: { execute: (q: ReturnType<typeof sql>) => Promise<unknown> },
  input: ProvisionTenantInput,
): Promise<ProvisionTenantResult> {
  await tx.execute(sql`
    UPDATE tenants
    SET licensing_tier = ${input.tier}, seat_limit = ${input.seatLimit}, updated_at = NOW()
    WHERE id = ${input.tenantId}
  `);

  const metadata = JSON.stringify({
    couponCode: input.couponCode,
    provisionedBy: input.provisionedBy,
    ...(input.attribution ?? {}),
  });

  const inserted = (await tx.execute(sql`
    INSERT INTO subscriptions (tenant_id, user_id, plan, status, current_period_end, metadata)
    VALUES (
      ${input.tenantId},
      ${input.userId},
      ${input.plan},
      'ACTIVE',
      NOW() + make_interval(days => ${input.durationDays}),
      ${metadata}
    )
    RETURNING current_period_end
  `)) as { rows?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;

  const rows = Array.isArray(inserted) ? inserted : (inserted.rows ?? []);
  return { expiresAt: rows[0]?.current_period_end ?? null };
}
