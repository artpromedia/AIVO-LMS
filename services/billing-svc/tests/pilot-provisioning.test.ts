/**
 * Sprint 1 — internal pilot-provisioning route tests (DB-backed).
 *
 * Proves the money/seat path: POST /api/billing/internal/pilots/provision sets
 * tenants.licensing_tier + seat_limit, inserts an ACTIVE subscription, mints +
 * redeems the PROVISIONING coupon exactly once, is idempotent on re-run, and is
 * guarded by the internal service token. Skips when DATABASE_URL is unset
 * (mirrors the other billing-svc tests).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;
const TOKEN = "test-internal-service-token";

async function bootstrap() {
  process.env.INTERNAL_SERVICE_TOKEN = TOKEN;
  const Fastify = (await import("fastify")).default;
  const { createDb } = await import("@aivo/db");
  const { registerCouponRoutes } = await import("../src/routes/coupons.js");
  const { registerPilotProvisioningRoutes } = await import("../src/routes/pilot-provisioning.js");
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify();
  // Coupons route ensures the billing_coupons table/columns exist in dev DBs.
  registerCouponRoutes(app, db);
  registerPilotProvisioningRoutes(app, db);
  await app.ready();
  return { app, db };
}

async function teardown(app: any, db: any) {
  const { closeDb } = await import("@aivo/db");
  await app.close();
  await closeDb(db);
}

async function seedDistrictTenant(db: any): Promise<string> {
  const { tenants } = await import("@aivo/db");
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: `Pilot Bill ${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      type: "B2B_DISTRICT",
    } as any)
    .returning();
  return tenant.id as string;
}

// The provisioned subscription's `user_id` (the platform actor) is a real FK
// into users.id, so the actor must exist before we provision. In production
// this is the authenticated platform-admin; here we seed a stand-in.
async function seedActorUser(db: any): Promise<string> {
  const { users } = await import("@aivo/db");
  const [user] = await db
    .insert(users)
    .values({
      email: `pilot-actor-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@aivo.dev`,
      name: "Pilot Actor",
      role: "PLATFORM_ADMIN",
      passwordHash:
        "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    } as any)
    .returning();
  return user.id as string;
}

function provisionBody(tenantId: string, actorUserId = "00000000-0000-0000-0000-0000000000aa") {
  return {
    tenantId,
    plan: "district",
    tier: "enterprise",
    seatLimit: 25,
    durationDays: 90,
    actorUserId,
  };
}

test("provision sets tier + seat_limit, inserts ACTIVE subscription, redeems coupon once", async (t) => {
  if (SKIP) return t.skip("DATABASE_URL not set");
  const { app, db } = await bootstrap();
  try {
    const { sql } = await import("drizzle-orm");
    const tenantId = await seedDistrictTenant(db);
    const actorUserId = await seedActorUser(db);

    const res = await app.inject({
      method: "POST",
      url: "/api/billing/internal/pilots/provision",
      headers: { "x-service-token": TOKEN },
      payload: provisionBody(tenantId, actorUserId),
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = res.json();
    assert.equal(body.ok, true);
    assert.equal(body.provisioned, true);
    assert.equal(body.tier, "enterprise");
    assert.equal(body.plan, "district");
    assert.equal(body.seatLimit, 25);
    assert.ok(body.couponCode.startsWith("PILOT-"));

    const tenantRows: any = await db.execute(
      sql`SELECT licensing_tier, seat_limit FROM tenants WHERE id = ${tenantId}`,
    );
    const trow = (Array.isArray(tenantRows) ? tenantRows : tenantRows.rows)[0];
    assert.equal(trow.licensing_tier, "enterprise");
    assert.equal(Number(trow.seat_limit), 25);

    const subRows: any = await db.execute(
      sql`SELECT status, plan, metadata FROM subscriptions WHERE tenant_id = ${tenantId}`,
    );
    const subs = Array.isArray(subRows) ? subRows : subRows.rows;
    assert.equal(subs.length, 1);
    assert.equal(subs[0].status, "ACTIVE");
    assert.equal(subs[0].plan, "district");

    const couponRows: any = await db.execute(
      sql`SELECT redemptions, coupon_type, max_redemptions FROM billing_coupons WHERE code = ${body.couponCode}`,
    );
    const crow = (Array.isArray(couponRows) ? couponRows : couponRows.rows)[0];
    assert.equal(Number(crow.redemptions), 1);
    assert.equal(crow.coupon_type, "PROVISIONING");

    const auditRows: any = await db.execute(
      sql`SELECT event_type FROM audit_events WHERE tenant_id = ${tenantId} AND event_type = 'billing.pilot.provisioned'`,
    );
    const audits = Array.isArray(auditRows) ? auditRows : auditRows.rows;
    assert.ok(audits.length >= 1, "billing.pilot.provisioned audit present");
  } finally {
    await teardown(app, db);
  }
});

test("provision is idempotent on (tenantId, couponCode) — no double seats/subscription", async (t) => {
  if (SKIP) return t.skip("DATABASE_URL not set");
  const { app, db } = await bootstrap();
  try {
    const { sql } = await import("drizzle-orm");
    const tenantId = await seedDistrictTenant(db);
    const actorUserId = await seedActorUser(db);

    const first = await app.inject({
      method: "POST",
      url: "/api/billing/internal/pilots/provision",
      headers: { "x-service-token": TOKEN },
      payload: provisionBody(tenantId, actorUserId),
    });
    assert.equal(first.statusCode, 200);
    assert.equal(first.json().provisioned, true);

    const second = await app.inject({
      method: "POST",
      url: "/api/billing/internal/pilots/provision",
      headers: { "x-service-token": TOKEN },
      payload: provisionBody(tenantId, actorUserId),
    });
    assert.equal(second.statusCode, 200);
    assert.equal(second.json().provisioned, false, "re-run reuses existing entitlement");

    const subRows: any = await db.execute(
      sql`SELECT id FROM subscriptions WHERE tenant_id = ${tenantId}`,
    );
    const subs = Array.isArray(subRows) ? subRows : subRows.rows;
    assert.equal(subs.length, 1, "no second subscription inserted");

    const couponRows: any = await db.execute(
      sql`SELECT redemptions FROM billing_coupons WHERE code = ${second.json().couponCode}`,
    );
    const crow = (Array.isArray(couponRows) ? couponRows : couponRows.rows)[0];
    assert.equal(Number(crow.redemptions), 1, "redemption counter not double-incremented");
  } finally {
    await teardown(app, db);
  }
});

test("internal-token guard: rejects missing/wrong x-service-token", async (t) => {
  if (SKIP) return t.skip("DATABASE_URL not set");
  const { app, db } = await bootstrap();
  try {
    const tenantId = await seedDistrictTenant(db);
    const missing = await app.inject({
      method: "POST",
      url: "/api/billing/internal/pilots/provision",
      payload: provisionBody(tenantId),
    });
    assert.equal(missing.statusCode, 401);

    const wrong = await app.inject({
      method: "POST",
      url: "/api/billing/internal/pilots/provision",
      headers: { "x-service-token": "nope" },
      payload: provisionBody(tenantId),
    });
    assert.equal(wrong.statusCode, 401);
  } finally {
    await teardown(app, db);
  }
});
