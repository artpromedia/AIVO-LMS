/**
 * Sprint 1 — POST /api/admin/pilots orchestration tests (DB-backed).
 *
 * Proves the platform-admin "Provision pilot" flow: the district + first-admin
 * invite are created, billing-svc is asked to provision the entitlement, the
 * `district.created` audit is written, auth is enforced, and a billing failure
 * rolls the district back (no half-provisioned tenant).
 *
 * The billing-svc + comms-svc calls are served by in-process stubs (the billing
 * stub's response is toggled to drive the success vs failure paths). The actual
 * tenant tier/seat/subscription DB writes are billing-svc's responsibility and
 * are covered by services/billing-svc/tests/pilot-provisioning.test.ts.
 *
 * Skips when DATABASE_URL is unset (mirrors the other identity-svc tests).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;

// Drives the billing stub: when false it 500s so we can assert rollback.
let billingShouldSucceed = true;

let cached: Awaited<ReturnType<typeof buildSetup>> | null = null;

async function buildSetup() {
  const Fastify = (await import("fastify")).default;
  const { createDb } = await import("@aivo/db");
  const db = createDb(process.env.DATABASE_URL!);

  // comms-svc stub: dev-mode invite so delivery "succeeds".
  const comms = Fastify();
  comms.post("/api/comms/internal/district-admin-invite", async () => ({
    status: "dev_mode",
    inviteUrl: "http://test.local/accept-invite?token=stub",
  }));
  await comms.listen({ port: 0, host: "127.0.0.1" });
  process.env.COMMS_SVC_URL = `http://127.0.0.1:${(comms.server.address() as any).port}`;

  // billing-svc stub: toggleable provision response.
  const billing = Fastify();
  billing.post("/api/billing/internal/pilots/provision", async (req, reply) => {
    if (!billingShouldSucceed) return reply.code(500).send({ error: "provision_failed" });
    const b = (req.body ?? {}) as any;
    return {
      ok: true,
      provisioned: true,
      couponCode: "PILOT-STUB1234",
      tier: b.tier ?? "enterprise",
      plan: b.plan ?? "enterprise",
      seatLimit: b.seatLimit ?? null,
      expiresAt: new Date(Date.now() + 60 * 86_400_000).toISOString(),
    };
  });
  await billing.listen({ port: 0, host: "127.0.0.1" });
  process.env.BILLING_SVC_URL = `http://127.0.0.1:${(billing.server.address() as any).port}`;

  // identity-svc pilots route (reads BILLING_SVC_URL / COMMS_SVC_URL set above).
  const { registerPilotRoutes } = await import("../src/routes/pilots.js");
  const identity = Fastify();
  (identity as any).db = db;
  await registerPilotRoutes(identity);
  await identity.ready();

  const { users } = await import("@aivo/db");
  const { signJWT } = await import("@aivo/security");
  const [admin] = await db
    .insert(users)
    .values({
      email: `pilot-admin-${Date.now()}@aivo.dev`,
      name: "Pilot Admin",
      role: "PLATFORM_ADMIN",
      passwordHash:
        "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    } as any)
    .returning();
  const adminToken = await signJWT({
    sub: admin.id,
    role: "PLATFORM_ADMIN",
    email: admin.email,
    tenantId: null,
    name: admin.name,
  } as any);

  return { identity, billing, comms, db, adminToken };
}

async function setup() {
  if (!cached) cached = await buildSetup();
  return cached;
}

function pilotBody(suffix: string) {
  return {
    districtName: `Pilot District ${suffix}`,
    adminName: "First Admin",
    adminEmail: `first-admin-${suffix}@district.test`,
    seatLimit: 30,
    durationDays: 60,
  };
}

test("rejects unauthenticated callers", async (t) => {
  if (SKIP) return t.skip("DATABASE_URL not set");
  const { identity } = await setup();
  const res = await identity.inject({
    method: "POST",
    url: "/api/admin/pilots",
    payload: pilotBody("noauth"),
  });
  assert.equal(res.statusCode, 401);
});

test("creates district + invite, provisions pilot, writes district.created audit", async (t) => {
  if (SKIP) return t.skip("DATABASE_URL not set");
  billingShouldSucceed = true;
  const { identity, db, adminToken } = await setup();
  const { sql } = await import("drizzle-orm");
  const suffix = `ok-${Date.now()}`;

  const res = await identity.inject({
    method: "POST",
    url: "/api/admin/pilots",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: pilotBody(suffix),
  });
  assert.equal(res.statusCode, 200, res.body);
  const body = res.json();
  const tenantId = body.district.id;
  assert.ok(tenantId);
  assert.equal(body.pilot.couponCode, "PILOT-STUB1234");
  assert.equal(body.pilot.seatLimit, 30);
  assert.ok(body.invite.email.startsWith("first-admin-"));

  // Tenant exists and carries the pilot settings stamped by the orchestrator.
  const tRows: any = await db.execute(sql`SELECT settings FROM tenants WHERE id = ${tenantId}`);
  const settings = (Array.isArray(tRows) ? tRows : tRows.rows)[0].settings;
  const parsed = typeof settings === "string" ? JSON.parse(settings) : settings;
  assert.equal(parsed.pilot.seatLimit, 30);
  assert.equal(parsed.pilot.durationDays, 60);

  // district.created audit written only after provisioning succeeded.
  const created: any = await db.execute(
    sql`SELECT action FROM admin_audit_log WHERE tenant_id = ${tenantId} AND action = 'district.created'`,
  );
  assert.ok((Array.isArray(created) ? created : created.rows).length >= 1);
});

test("rolls the district back when billing provisioning fails", async (t) => {
  if (SKIP) return t.skip("DATABASE_URL not set");
  billingShouldSucceed = false;
  const { identity, db, adminToken } = await setup();
  const { sql } = await import("drizzle-orm");
  const suffix = `rollback-${Date.now()}`;
  const districtName = `Pilot District ${suffix}`;

  const res = await identity.inject({
    method: "POST",
    url: "/api/admin/pilots",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: pilotBody(suffix),
  });
  assert.equal(res.statusCode, 502);

  const tRows: any = await db.execute(sql`SELECT id FROM tenants WHERE name = ${districtName}`);
  assert.equal(
    (Array.isArray(tRows) ? tRows : tRows.rows).length,
    0,
    "bare tenant was deleted — no district left without entitlement",
  );
});

test.after(async () => {
  if (cached) {
    const { identity, billing, comms, db } = cached;
    const { closeDb } = await import("@aivo/db");
    await identity.close();
    await billing.close();
    await comms.close();
    await closeDb(db);
  }
});
