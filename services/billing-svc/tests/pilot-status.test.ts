/**
 * Sprint 4 — pilot ops read model (DB-backed).
 *
 * Proves GET /api/billing/admin/pilots/:tenantId joins the ACTIVE pilot
 * subscription + tenant + provisioning-coupon redemptions + onboarded parents,
 * is platform-admin guarded, and reports the seat cap / expiry / status.
 * Skips when DATABASE_URL is unset.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { createDb } = await import("@aivo/db");
  const { registerPilotStatusRoutes } = await import("../src/routes/pilot-status.js");
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify();
  registerPilotStatusRoutes(app, db);
  await app.ready();
  return { app, db };
}

test("rejects non-platform-admin callers", async (t) => {
  if (SKIP) return t.skip("DATABASE_URL not set");
  const { app, db } = await bootstrap();
  const { closeDb } = await import("@aivo/db");
  try {
    const res = await app.inject({ method: "GET", url: "/api/billing/admin/pilots" });
    assert.equal(res.statusCode, 401);
  } finally {
    await app.close();
    await closeDb(db);
  }
});

test("returns a district's live pilot status from real reads", async (t) => {
  if (SKIP) return t.skip("DATABASE_URL not set");
  const { app, db } = await bootstrap();
  const { closeDb, tenants, users } = await import("@aivo/db");
  const { signJWT } = await import("@aivo/security");
  const { sql } = await import("drizzle-orm");
  try {
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: `Pilot Status ${Date.now()}`,
        type: "B2B_DISTRICT",
        licensingTier: "enterprise",
        seatLimit: 5,
      } as any)
      .returning();

    // One onboarded parent under the district tenant. Created up front so the
    // ACTIVE subscription below can reference a real user (subscriptions.user_id
    // is NOT NULL with an FK to users.id).
    const [parent] = await db
      .insert(users)
      .values({
        email: `pstat-parent-${Date.now()}@fam.test`,
        name: "Stat Parent",
        role: "PARENT",
        tenantId: tenant.id,
        passwordHash:
          "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      } as any)
      .returning();

    // A therapist onboarded under the same tenant → therapistsOnboarded = 1.
    await db.insert(users).values({
      email: `pstat-therapist-${Date.now()}@fam.test`,
      name: "Stat Therapist",
      role: "THERAPIST",
      tenantId: tenant.id,
      passwordHash:
        "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    } as any);

    const code = `PILOT-STAT-${Date.now()}`.toUpperCase().slice(0, 40);
    await db.execute(sql`
      INSERT INTO billing_coupons
        (code, coupon_type, grants_tier, grants_plan, grants_seat_limit, grants_duration_days, redemptions, max_redemptions)
      VALUES (${code}, 'PROVISIONING', 'enterprise', 'district', 5, 90, 1, 1)
    `);
    await db.execute(sql`
      INSERT INTO subscriptions (tenant_id, user_id, plan, status, current_period_end, metadata)
      VALUES (${tenant.id}, ${parent.id}, 'district', 'ACTIVE', now() + make_interval(days => 90),
        ${JSON.stringify({ couponCode: code, provisionedBy: "pilot" })})
    `);

    const token = await signJWT({
      sub: "00000000-0000-0000-0000-0000000000ad",
      role: "PLATFORM_ADMIN",
      email: "ops@aivo.dev",
      tenantId: null,
      name: "Ops",
    } as any);

    const res = await app.inject({
      method: "GET",
      url: `/api/billing/admin/pilots/${tenant.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 200, res.body);
    const { pilot } = res.json();
    assert.equal(pilot.plan, "district");
    assert.equal(pilot.tier, "enterprise");
    assert.equal(pilot.seatLimit, 5);
    assert.equal(pilot.seatsUsed, 0); // no web learners yet
    assert.equal(pilot.seatsRemaining, 5);
    assert.equal(pilot.parentsOnboarded, 1);
    assert.equal(pilot.therapistsOnboarded, 1);
    assert.equal(pilot.couponCode, code);
    assert.equal(pilot.redemptions, 1);
    assert.equal(pilot.status, "active");
    assert.ok(pilot.expiresAt);
  } finally {
    await app.close();
    await closeDb(db);
  }
});
