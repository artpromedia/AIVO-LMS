/**
 * Sprint 1 — internal pilot provisioning.
 *
 *   POST /api/billing/internal/pilots/provision
 *
 * Service-to-service only (identity-svc → billing-svc via admin-api's
 * `x-service-token`). Mints a single-use `PROVISIONING` coupon for a freshly
 * created district tenant and redeems it FOR that tenant in one transaction, so
 * a district is born WITH its entitlement + seat cap — no human re-keys a code.
 *
 * Idempotent on `(tenantId, couponCode)`: a re-run that finds the tenant already
 * carries an ACTIVE subscription minted by this coupon returns the existing
 * entitlement (`provisioned: false`) without touching seats or the redemption
 * counter again.
 *
 * Shares `provisionTenantEntitlement` with the parent coupon-redeem path so the
 * money/seat write can never drift between the two entry points.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sql } from "drizzle-orm";
import { createLogger } from "@aivo/observability";
import { emitBillingAudit } from "../lib/audit.js";
import { couponsCreated, couponsRedeemed } from "../lib/metrics.js";
import { provisionTenantEntitlement } from "../lib/provision-tenant.js";
import { internalProvisionPilotSchema } from "./schemas.js";

const log = createLogger("billing-svc.pilot-provisioning");

const IS_PROD = process.env.NODE_ENV === "production";

/** The shared internal-service secret admin-api / identity-svc send as
 *  `x-service-token`. Mirrors packages/admin-api/src/env.ts resolution. */
function expectedInternalToken(): string {
  return (
    process.env.INTERNAL_SERVICE_TOKEN ||
    process.env.INTERNAL_SERVICE_KEY ||
    (IS_PROD ? "" : "aivo-internal-dev-token")
  );
}

function requireInternalToken(req: FastifyRequest, reply: FastifyReply): boolean {
  const expected = expectedInternalToken();
  if (!expected) {
    reply.code(503).send({ error: "internal_service_token_unconfigured" });
    return false;
  }
  const got = req.headers["x-service-token"];
  if (got !== expected) {
    reply.code(401).send({ error: "internal_service_token_required" });
    return false;
  }
  return true;
}

/** Deterministic per-tenant pilot code, e.g. `PILOT-1A2B3C4D`. Re-running the
 *  flow for the same tenant resolves to the same code → idempotent. */
function deterministicPilotCode(tenantId: string): string {
  const short = tenantId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `PILOT-${short}`;
}

type Rows = { rows?: Array<Record<string, any>> } | Array<Record<string, any>>;
function asRows(result: Rows): Array<Record<string, any>> {
  return Array.isArray(result) ? result : (result.rows ?? []);
}

export function registerPilotProvisioningRoutes(app: FastifyInstance, db: any) {
  app.post(
    "/api/billing/internal/pilots/provision",
    { schema: internalProvisionPilotSchema },
    async (req, reply) => {
      if (!requireInternalToken(req, reply)) return;

      const body = (req.body ?? {}) as Record<string, unknown>;
      const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
      const plan = typeof body.plan === "string" ? body.plan.trim() : "";
      const actorUserId = typeof body.actorUserId === "string" ? body.actorUserId.trim() : "";
      const tier = typeof body.tier === "string" && body.tier.trim() ? body.tier.trim() : plan;
      const seatLimit =
        body.seatLimit == null
          ? null
          : Number.isFinite(Number(body.seatLimit))
            ? Number(body.seatLimit)
            : null;
      const durationDays = Number(body.durationDays);
      const couponCode =
        typeof body.couponCode === "string" && body.couponCode.trim()
          ? body.couponCode.trim().toUpperCase()
          : deterministicPilotCode(tenantId);

      if (!tenantId || !plan || !actorUserId) {
        return reply.code(400).send({ error: "missing_fields" });
      }
      if (!Number.isInteger(durationDays) || durationDays <= 0 || durationDays > 3650) {
        return reply.code(400).send({ error: "invalid_duration" });
      }
      if (seatLimit != null && (!Number.isInteger(seatLimit) || seatLimit < 1)) {
        return reply.code(400).send({ error: "invalid_seat_limit" });
      }
      if (!/^[A-Z0-9_-]{2,64}$/.test(couponCode)) {
        return reply.code(400).send({ error: "invalid_coupon_code" });
      }

      // ── Idempotency: did a prior run already provision this (tenant, code)? ──
      const existing = asRows(
        (await db.execute(sql`
          SELECT current_period_end, status
          FROM subscriptions
          WHERE tenant_id = ${tenantId}
            AND metadata ->> 'couponCode' = ${couponCode}
            AND status = 'ACTIVE'
          ORDER BY id DESC
          LIMIT 1
        `)) as Rows,
      );
      if (existing[0]) {
        const tenantRow = asRows(
          (await db.execute(sql`
            SELECT licensing_tier, seat_limit FROM tenants WHERE id = ${tenantId} LIMIT 1
          `)) as Rows,
        )[0];
        return {
          ok: true,
          provisioned: false,
          couponCode,
          tier: tenantRow?.licensing_tier ?? tier,
          plan,
          seatLimit: tenantRow?.seat_limit ?? seatLimit,
          expiresAt: existing[0].current_period_end ?? null,
        };
      }

      // ── Mint the coupon (idempotent) + redeem it for the tenant, atomically ─
      let couponCreated = false;
      let expiresAt: unknown = null;
      await db.transaction(async (tx: any) => {
        const inserted = asRows(
          (await tx.execute(sql`
            INSERT INTO billing_coupons (
              code, description, discount_pct, max_redemptions, coupon_type,
              grants_tier, grants_plan, grants_seat_limit, grants_duration_days
            )
            VALUES (
              ${couponCode}, ${`Pilot provisioning for ${tenantId}`}, 0, 1, 'PROVISIONING',
              ${tier}, ${plan}, ${seatLimit}, ${durationDays}
            )
            ON CONFLICT (code) DO NOTHING
            RETURNING code
          `)) as Rows,
        );
        couponCreated = inserted.length > 0;

        const result = await provisionTenantEntitlement(tx, {
          tenantId,
          userId: actorUserId,
          plan,
          tier,
          seatLimit,
          durationDays,
          couponCode,
          provisionedBy: "pilot",
        });
        expiresAt = result.expiresAt;

        await tx.execute(sql`
          UPDATE billing_coupons SET redemptions = redemptions + 1 WHERE code = ${couponCode}
        `);
      });

      if (couponCreated) {
        couponsCreated.increment(1, { type: "PROVISIONING" });
        await emitBillingAudit(db, log, {
          eventType: "billing.coupon.created",
          tenantId,
          userId: actorUserId,
          resourceId: couponCode,
          details: {
            couponType: "PROVISIONING",
            code: couponCode,
            grantsTier: tier,
            grantsPlan: plan,
            grantsSeatLimit: seatLimit,
            grantsDurationDays: durationDays,
            provisionedBy: "pilot",
          },
        });
      }
      couponsRedeemed.increment(1, { type: "PROVISIONING" });
      await emitBillingAudit(db, log, {
        eventType: "billing.coupon.redeemed",
        tenantId,
        userId: actorUserId,
        resourceId: couponCode,
        details: {
          couponType: "PROVISIONING",
          code: couponCode,
          grantsTier: tier,
          grantsPlan: plan,
          grantsSeatLimit: seatLimit,
          provisionedBy: "pilot",
        },
      });
      await emitBillingAudit(db, log, {
        eventType: "billing.pilot.provisioned",
        tenantId,
        userId: actorUserId,
        resourceId: tenantId,
        details: { couponCode, tier, plan, seatLimit, durationDays },
      });

      return {
        ok: true,
        provisioned: true,
        couponCode,
        tier,
        plan,
        seatLimit,
        expiresAt,
      };
    },
  );
}
