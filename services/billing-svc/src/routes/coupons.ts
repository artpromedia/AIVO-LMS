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
import {
  listCouponsSchema,
  createCouponSchema,
  deactivateCouponSchema,
  validateCouponSchema,
  redeemCouponSchema,
} from "./schemas.js";

/**
 * Per-user 10-req/min token bucket on the redeem path to prevent
 * brute-force coupon code probing.
 */
const REDEEM_RATE_BURST = 10;
const REDEEM_RATE_WINDOW_MS = 60_000;
const redeemBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRedeemRateLimit(subject: string, now: number): boolean {
  const b = redeemBuckets.get(subject);
  if (!b || b.resetAt <= now) {
    redeemBuckets.set(subject, { count: 1, resetAt: now + REDEEM_RATE_WINDOW_MS });
    return true;
  }
  if (b.count >= REDEEM_RATE_BURST) return false;
  b.count += 1;
  return true;
}

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
  // Defense-in-depth: ensure the table exists. Drizzle migrations would do this
  // in a real deploy, but coupons is admin-only and the dev env may not have run
  // migrations recently.
  void db
    .execute(
      sql`
      CREATE TABLE IF NOT EXISTS billing_coupons (
        code            varchar(64) PRIMARY KEY,
        description     text,
        discount_pct    integer NOT NULL DEFAULT 0,
        max_redemptions integer,
        redemptions     integer NOT NULL DEFAULT 0,
        active          boolean NOT NULL DEFAULT true,
        created_at      timestamptz NOT NULL DEFAULT NOW(),
        expires_at      timestamptz
      )
    `,
    )
    .catch(() => {})
    .then(() =>
      Promise.all([
        db
          .execute(
            sql`ALTER TABLE billing_coupons ADD COLUMN IF NOT EXISTS coupon_type varchar(20) NOT NULL DEFAULT 'DISCOUNT'`,
          )
          .catch(() => {}),
        db
          .execute(
            sql`ALTER TABLE billing_coupons ADD COLUMN IF NOT EXISTS grants_tier varchar(30)`,
          )
          .catch(() => {}),
        db
          .execute(
            sql`ALTER TABLE billing_coupons ADD COLUMN IF NOT EXISTS grants_plan varchar(50)`,
          )
          .catch(() => {}),
        db
          .execute(
            sql`ALTER TABLE billing_coupons ADD COLUMN IF NOT EXISTS grants_seat_limit integer`,
          )
          .catch(() => {}),
        db
          .execute(
            sql`ALTER TABLE billing_coupons ADD COLUMN IF NOT EXISTS grants_duration_days integer`,
          )
          .catch(() => {}),
      ]),
    )
    .catch(() => {});

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
    reply.code(201).send({ ok: true, code });
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

    // Rate-limit: 10 redemption attempts per user per minute
    if (!checkRedeemRateLimit(jwtPayload.sub as string, Date.now())) {
      return reply.code(429).send({ error: "too_many_requests" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";

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
            ${JSON.stringify({ couponCode: row.code, type: "subscription_duration", grantedDays: grantsDurationDays })}
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

    // Run the provisioning in a transaction (including redemption counter)
    await db.transaction(async (tx: any) => {
      await tx.execute(sql`
        UPDATE tenants SET licensing_tier = ${grantsTier}, seat_limit = ${grantsSeatLimit}, updated_at = NOW()
        WHERE id = ${tenantId}
      `);
      await tx.execute(sql`
        INSERT INTO subscriptions (tenant_id, user_id, plan, status, current_period_end, metadata)
        VALUES (
          ${tenantId},
          ${userId},
          ${grantsPlan},
          'ACTIVE',
          NOW() + make_interval(days => ${grantsDurationDays}),
          ${JSON.stringify({ couponCode: row.code, provisionedBy: "coupon" })}
        )
      `);
      await tx.execute(sql`
        UPDATE billing_coupons SET redemptions = redemptions + 1 WHERE code = ${row.code}
      `);
    });

    const expiresResult = (await db.execute(sql`
      SELECT current_period_end FROM subscriptions
      WHERE tenant_id = ${tenantId} AND user_id = ${userId} AND plan = ${grantsPlan}
      ORDER BY id DESC LIMIT 1
    `)) as { rows?: Array<Record<string, any>> } | Array<Record<string, any>>;
    const expiresRows = Array.isArray(expiresResult) ? expiresResult : (expiresResult.rows ?? []);
    expiresAt = expiresRows[0]?.current_period_end ?? null;

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
