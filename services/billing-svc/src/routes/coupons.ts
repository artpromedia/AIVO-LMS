/**
 * Sprint 7 — admin coupon management routes.
 *
 *   GET    /api/billing/admin/coupons
 *   POST   /api/billing/admin/coupons
 *   DELETE /api/billing/admin/coupons/:code
 *
 * Public endpoints (no auth required):
 *   POST   /api/billing/coupons/validate
 *
 * Authenticated endpoints (Bearer JWT, PARENT minimum):
 *   POST   /api/billing/coupons/redeem
 *
 * Same hand-rolled "Bearer JWT + role===PLATFORM_ADMIN" check as the daily-jobs
 * endpoint (Task #70 covers them with end-to-end auth tests).
 */
import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { requirePlatformAdmin } from "./daily-jobs.js";
import { verifyJWT } from "@aivo/security";
import { createLogger } from "@aivo/observability";
import { emitBillingAudit } from "../lib/audit.js";
import { couponsCreated, couponsRedeemed } from "../lib/metrics.js";
import { pickAttribution } from "../lib/attribution.js";
import { provisionTenantEntitlement } from "../lib/provision-tenant.js";
import { consumeRateLimit } from "../lib/redeem-rate-limit.js";
import {
  listCouponsSchema,
  createCouponSchema,
  deactivateCouponSchema,
  validateCouponSchema,
  redeemCouponSchema,
} from "./schemas.js";

const auditLog = createLogger("billing-svc.coupons");

/**
 * Per-user 10-req/min token bucket on the redeem path to prevent brute-force
 * coupon-code probing. Backed by Postgres (`billing_rate_limits`) so the limit
 * holds across replicas — see lib/redeem-rate-limit.ts.
 */
const REDEEM_RATE_BURST = 10;
const REDEEM_RATE_WINDOW_SECONDS = 60;

async function lookupCoupon(db: any, code: string): Promise<Record<string, any> | null> {
  const result = (await db.execute(sql`
    SELECT code, description, discount_pct, max_redemptions, redemptions, active,
           expires_at, coupon_type, grants_tier, grants_plan, grants_seat_limit,
           grants_duration_days
    FROM billing_coupons
    WHERE UPPER(TRIM(code)) = UPPER(TRIM(${code}))
    LIMIT 1
  `)) as { rows?: Array<Record<string, any>> } | Array<Record<string, any>>;
  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  return rows[0] ?? null;
}

function validateCouponRow(
  row: Record<string, any>,
): { valid: false; reason: string } | { valid: true } {
  if (!row.active) return { valid: false, reason: "inactive" };
  if (row.expires_at && new Date(row.expires_at) < new Date())
    return { valid: false, reason: "expired" };
  if (row.max_redemptions != null && row.redemptions >= row.max_redemptions)
    return { valid: false, reason: "exhausted" };
  return { valid: true };
}

export function registerCouponRoutes(app: FastifyInstance, db: any) {
  // The `billing_coupons` table is owned by a canonical migration
  // (packages/db/drizzle/0090_billing_coupons.sql, applied by `db:migrate`).
  // The previous in-route `CREATE TABLE`/`ALTER` bootstrap is intentionally
  // gone — fresh DBs and the schema-drift gate now agree.

  app.get("/api/billing/admin/coupons", { schema: listCouponsSchema }, async (req, reply) => {
    const me = await requirePlatformAdmin(req, reply);
    if (!me) return;
    const result = (await db.execute(sql`
      SELECT code, description, discount_pct, max_redemptions, redemptions, active,
             created_at, expires_at, coupon_type, grants_tier, grants_plan,
             grants_seat_limit, grants_duration_days
      FROM billing_coupons
      ORDER BY created_at DESC
      LIMIT 500
    `)) as { rows?: Array<Record<string, any>> } | Array<Record<string, any>>;
    const rows = Array.isArray(result) ? result : (result.rows ?? []);
    return { coupons: rows };
  });

  app.post("/api/billing/admin/coupons", { schema: createCouponSchema }, async (req, reply) => {
    const me = await requirePlatformAdmin(req, reply);
    if (!me) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const description = typeof body.description === "string" ? body.description : null;
    const couponType: "DISCOUNT" | "SUBSCRIPTION" | "PROVISIONING" =
      body.couponType === "SUBSCRIPTION"
        ? "SUBSCRIPTION"
        : body.couponType === "PROVISIONING"
          ? "PROVISIONING"
          : "DISCOUNT";
    const discountPct = Number(body.discountPct ?? 0);
    const maxRedemptions = body.maxRedemptions != null ? Number(body.maxRedemptions) : null;
    const expiresAt = typeof body.expiresAt === "string" ? new Date(body.expiresAt) : null;
    const grantsTier = typeof body.grantsTier === "string" ? body.grantsTier : null;
    const grantsPlan = typeof body.grantsPlan === "string" ? body.grantsPlan : null;
    const grantsSeatLimit = body.grantsSeatLimit != null ? Number(body.grantsSeatLimit) : null;
    const grantsDurationDays =
      body.grantsDurationDays != null ? Number(body.grantsDurationDays) : null;

    if (!code || !/^[A-Z0-9_-]{2,64}$/.test(code)) {
      reply.code(400).send({ error: "invalid_code" });
      return;
    }

    if (couponType === "DISCOUNT") {
      if (!Number.isFinite(discountPct) || discountPct < 1 || discountPct > 100) {
        reply.code(400).send({ error: "invalid_discount" });
        return;
      }
    } else if (couponType === "SUBSCRIPTION") {
      if (!grantsDurationDays || grantsDurationDays < 1) {
        reply.code(400).send({ error: "subscription_coupon_missing_duration" });
        return;
      }
    } else {
      if (!grantsTier || !grantsPlan || !grantsDurationDays) {
        reply.code(400).send({ error: "provisioning_coupon_missing_fields" });
        return;
      }
    }

    try {
      await db.execute(sql`
        INSERT INTO billing_coupons (
          code, description, discount_pct, max_redemptions, expires_at,
          coupon_type, grants_tier, grants_plan, grants_seat_limit, grants_duration_days
        )
        VALUES (
          ${code}, ${description}, ${discountPct}, ${maxRedemptions}, ${expiresAt},
          ${couponType}, ${grantsTier}, ${grantsPlan}, ${grantsSeatLimit}, ${grantsDurationDays}
        )
      `);
    } catch {
      reply.code(409).send({ error: "duplicate_code" });
      return;
    }

    couponsCreated.increment(1, { type: couponType });
    await emitBillingAudit(db, auditLog, {
      eventType: "billing.coupon.created",
      userId: me.sub ?? null,
      resourceId: code,
      details: {
        couponType,
        code,
        discountPct: couponType === "DISCOUNT" ? discountPct : undefined,
        grantsTier,
        grantsPlan,
        grantsSeatLimit,
        grantsDurationDays,
        maxRedemptions,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
      },
    });

    reply.code(201).send({ ok: true, code });
  });

  // ── Admin: fetch a single coupon (detail + live redemption count) ──────────
  app.get("/api/billing/admin/coupons/:code", async (req, reply) => {
    const me = await requirePlatformAdmin(req, reply);
    if (!me) return;
    const { code } = req.params as { code: string };
    const row = await lookupCoupon(db, code);
    if (!row) {
      reply.code(404).send({ error: "not_found" });
      return;
    }
    return { coupon: row };
  });

  app.delete(
    "/api/billing/admin/coupons/:code",
    { schema: deactivateCouponSchema },
    async (req, reply) => {
      const me = await requirePlatformAdmin(req, reply);
      if (!me) return;
      const params = req.params as { code: string };
      await db.execute(sql`
      UPDATE billing_coupons SET active = false WHERE code = ${params.code}
    `);
      await emitBillingAudit(db, auditLog, {
        eventType: "billing.coupon.disabled",
        userId: me.sub ?? null,
        resourceId: params.code,
        details: { code: params.code },
      });
      return { ok: true, code: params.code };
    },
  );

  // ── Public: validate a coupon code (no auth required) ──────────────────────
  app.post(
    "/api/billing/coupons/validate",
    { schema: validateCouponSchema },
    async (req, reply) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const code = typeof body.code === "string" ? body.code.trim() : "";
      if (!code) {
        return reply.code(400).send({ valid: false, reason: "missing_code" });
      }

      const row = await lookupCoupon(db, code);
      if (!row) return { valid: false, reason: "not_found" };

      const check = validateCouponRow(row);
      if (!check.valid) return check;

      return {
        valid: true,
        couponType: row.coupon_type ?? "DISCOUNT",
        discountPct: row.discount_pct ?? 0,
        grantsTier: row.grants_tier ?? null,
        grantsPlan: row.grants_plan ?? null,
        grantsSeatLimit: row.grants_seat_limit ?? null,
        grantsDurationDays: row.grants_duration_days ?? null,
        description: row.description ?? null,
      };
    },
  );

  // ── Authenticated: redeem a coupon (PARENT minimum) ────────────────────────
  app.post("/api/billing/coupons/redeem", { schema: redeemCouponSchema }, async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }
    let jwtPayload: any;
    try {
      jwtPayload = await verifyJWT(auth.slice(7).trim());
    } catch {
      return reply.code(401).send({ error: "invalid_token" });
    }

    // Rate-limit: 10 redemption attempts per user per minute (durable bucket).
    const rl = await consumeRateLimit(db, {
      scope: "coupon:redeem",
      subject: String(jwtPayload.sub),
      burst: REDEEM_RATE_BURST,
      windowSeconds: REDEEM_RATE_WINDOW_SECONDS,
    });
    if (!rl.allowed) {
      return reply.code(429).send({ error: "too_many_requests" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    // Campaign attribution from the ?coupon=&utm_… signup link, persisted on
    // the subscription metadata for pilot conversion reporting.
    const attribution = pickAttribution(body);

    if (!code || !tenantId) {
      return reply.code(400).send({ error: "missing_fields" });
    }

    // Only allow the user to redeem for their own tenant (or PLATFORM_ADMIN)
    if (jwtPayload.role !== "PLATFORM_ADMIN" && jwtPayload.tenantId !== tenantId) {
      return reply.code(403).send({ error: "tenant_mismatch" });
    }

    const row = await lookupCoupon(db, code);
    if (!row) return reply.code(404).send({ ok: false, error: "not_found" });

    const check = validateCouponRow(row);
    if (!check.valid) return reply.code(422).send({ ok: false, ...check });

    const couponType: string = row.coupon_type ?? "DISCOUNT";

    if (couponType === "DISCOUNT") {
      await db.execute(sql`
        UPDATE billing_coupons SET redemptions = redemptions + 1 WHERE code = ${row.code}
      `);
      couponsRedeemed.increment(1, { type: "DISCOUNT" });
      await emitBillingAudit(db, auditLog, {
        eventType: "billing.coupon.redeemed",
        tenantId,
        userId: jwtPayload.sub ?? null,
        resourceId: row.code,
        details: { couponType: "DISCOUNT", code: row.code, discountPct: row.discount_pct ?? 0 },
      });
      return {
        ok: true,
        couponType: "DISCOUNT",
        discountPct: row.discount_pct ?? 0,
        message: "Discount applied",
      };
    }

    // SUBSCRIPTION or PROVISIONING coupon
    const userId: string = jwtPayload.sub;

    if (couponType === "SUBSCRIPTION") {
      // Subscription duration coupon: grants direct subscription time
      const rawDuration = Number(row.grants_duration_days);
      if (!Number.isInteger(rawDuration) || rawDuration <= 0 || rawDuration > 3650) {
        return reply.code(500).send({ error: "invalid_coupon_duration" });
      }
      const grantsDurationDays: number = rawDuration;

      let expiresAt: unknown = null;
      await db.transaction(async (tx: any) => {
        await tx.execute(sql`
          INSERT INTO subscriptions (tenant_id, user_id, plan, status, current_period_end, metadata)
          VALUES (
            ${tenantId},
            ${userId},
            'subscription_duration',
            'ACTIVE',
            NOW() + make_interval(days => ${grantsDurationDays}),
            ${JSON.stringify({ couponCode: row.code, type: "subscription_duration", grantedDays: grantsDurationDays, ...attribution })}
          )
        `);
        await tx.execute(sql`
          UPDATE billing_coupons SET redemptions = redemptions + 1 WHERE code = ${row.code}
        `);
      });

      const expiresResult = (await db.execute(sql`
        SELECT current_period_end FROM subscriptions
        WHERE tenant_id = ${tenantId} AND user_id = ${userId} AND plan = 'subscription_duration'
        ORDER BY id DESC LIMIT 1
      `)) as { rows?: Array<Record<string, any>> } | Array<Record<string, any>>;
      const expiresRows = Array.isArray(expiresResult) ? expiresResult : (expiresResult.rows ?? []);
      expiresAt = expiresRows[0]?.current_period_end ?? null;

      couponsRedeemed.increment(1, { type: "SUBSCRIPTION" });
      await emitBillingAudit(db, auditLog, {
        eventType: "billing.coupon.redeemed",
        tenantId,
        userId,
        resourceId: row.code,
        details: { couponType: "SUBSCRIPTION", code: row.code, grantsDurationDays },
      });

      return {
        ok: true,
        couponType: "SUBSCRIPTION",
        grantsDurationDays,
        expiresAt,
        message: `${grantsDurationDays}-day subscription granted`,
      };
    }

    // PROVISIONING coupon
    const grantsTier: string = row.grants_tier;
    const grantsPlan: string = row.grants_plan;
    const grantsSeatLimit: number | null = row.grants_seat_limit ?? null;
    // Ensure grantsDurationDays is a safe positive integer (guards against DB corruption)
    const rawDuration = Number(row.grants_duration_days);
    if (!Number.isInteger(rawDuration) || rawDuration <= 0 || rawDuration > 3650) {
      return reply.code(500).send({ error: "invalid_coupon_duration" });
    }
    const grantsDurationDays: number = rawDuration;

    let expiresAt: unknown = null;

    // Run the provisioning in a transaction (including redemption counter).
    // The tenant-update + subscription-insert is the SHARED money/seat path —
    // see provisionTenantEntitlement (also used by the internal pilot-provision
    // route) so the two can never drift.
    await db.transaction(async (tx: any) => {
      const result = await provisionTenantEntitlement(tx, {
        tenantId,
        userId,
        plan: grantsPlan,
        tier: grantsTier,
        seatLimit: grantsSeatLimit,
        durationDays: grantsDurationDays,
        couponCode: row.code,
        provisionedBy: "coupon",
        attribution,
      });
      expiresAt = result.expiresAt;
      await tx.execute(sql`
        UPDATE billing_coupons SET redemptions = redemptions + 1 WHERE code = ${row.code}
      `);
    });

    couponsRedeemed.increment(1, { type: "PROVISIONING" });
    await emitBillingAudit(db, auditLog, {
      eventType: "billing.coupon.redeemed",
      tenantId,
      userId,
      resourceId: row.code,
      details: {
        couponType: "PROVISIONING",
        code: row.code,
        grantsTier,
        grantsPlan,
        grantsSeatLimit,
      },
    });

    return {
      ok: true,
      couponType: "PROVISIONING",
      grantsTier,
      grantsPlan,
      grantsSeatLimit,
      expiresAt,
    };
  });
}
