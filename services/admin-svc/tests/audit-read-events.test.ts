/**
 * Sprint B4: sensitive-READ audit ingestion tests.
 *
 * Exercises POST /api/admin-svc/audit-log/read-events end-to-end against
 * the dev DB (DATABASE_URL): permission gate, action/resource validation,
 * the (actor, resource) dedupe window, and the double append — platform
 * trail (admin_audit_log) plus the district-visible copy
 * (district_activity_log) — with the district chain still verifying.
 */
import { test } from "node:test";
import assert from "node:assert";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { createDb, closeDb, users, tenants } = await import("@aivo/db");
  const { signJWT } = await import("@aivo/security");
  const { registerAuditRoutes } = await import("../src/routes/audit");
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify();
  registerAuditRoutes(app, db);
  await app.ready();

  const [admin] = await db
    .insert(users)
    .values({
      email: `test-read-audit-${Date.now()}@aivo.dev`,
      name: "Read Audit Admin",
      role: "PLATFORM_ADMIN",
      passwordHash:
        "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    } as any)
    .returning();
  const [tenant] = await db
    .insert(tenants)
    .values({ name: `Read Audit District ${Date.now()}`, type: "B2B_DISTRICT" } as any)
    .returning();
  const token = await signJWT({
    sub: admin.id,
    role: "PLATFORM_ADMIN",
    email: admin.email,
    tenantId: null,
    name: "Read Audit Admin",
  } as any);
  return {
    app,
    db,
    closeDb,
    admin,
    tenant,
    auth: { Authorization: `Bearer ${token}` },
  };
}

async function cleanup(db: any, adminId: string) {
  const { users } = await import("@aivo/db");
  const { eq } = await import("drizzle-orm");
  // Audit rows are append-only by trigger — only the helper user goes.
  // The tenant row stays referenced by the activity log, so it remains.
  await db
    .delete(users)
    .where(eq(users.id, adminId))
    .catch(() => {});
}

test("read-events: validation rejects unknown actions and mismatched types", { skip: SKIP }, async () => {
  const { app, db, closeDb, admin, auth } = await bootstrap();
  try {
    let res = await app.inject({
      method: "POST",
      url: "/api/admin-svc/audit-log/read-events",
      headers: auth,
      payload: { events: [{ action: "admin.user.deleted", resourceType: "user", resourceId: "x" }] },
    });
    assert.equal(res.statusCode, 400, res.body);

    res = await app.inject({
      method: "POST",
      url: "/api/admin-svc/audit-log/read-events",
      headers: auth,
      payload: { events: [{ action: "admin.user.viewed", resourceType: "learner", resourceId: "x" }] },
    });
    assert.equal(res.statusCode, 400, res.body);

    res = await app.inject({
      method: "POST",
      url: "/api/admin-svc/audit-log/read-events",
      headers: auth,
      payload: { events: [] },
    });
    assert.equal(res.statusCode, 400, res.body);

    res = await app.inject({
      method: "POST",
      url: "/api/admin-svc/audit-log/read-events",
      headers: auth,
      payload: {
        events: [
          { action: "admin.user.viewed", resourceType: "user", resourceId: "u1", tenantId: "not-a-uuid" },
        ],
      },
    });
    assert.equal(res.statusCode, 400, res.body);
  } finally {
    await cleanup(db, admin.id);
    await app.close();
    await closeDb();
  }
});

test("read-events: requires an admin permission (learner token is refused)", { skip: SKIP }, async () => {
  const { app, db, closeDb, admin } = await bootstrap();
  const { signJWT } = await import("@aivo/security");
  try {
    const token = await signJWT({
      sub: admin.id,
      role: "LEARNER",
      email: admin.email,
      tenantId: null,
    } as any);
    const res = await app.inject({
      method: "POST",
      url: "/api/admin-svc/audit-log/read-events",
      headers: { Authorization: `Bearer ${token}` },
      payload: { events: [{ action: "admin.user.viewed", resourceType: "user", resourceId: "u1" }] },
    });
    assert.equal(res.statusCode, 403, res.body);
  } finally {
    await cleanup(db, admin.id);
    await app.close();
    await closeDb();
  }
});

test(
  "read-events: records once, dedupes the refresh, lands on BOTH chains, chain verifies",
  { skip: SKIP },
  async () => {
    const { app, db, closeDb, admin, tenant, auth } = await bootstrap();
    const { adminAuditLog, districtActivityLog, verifyAuditChainRange } = await import("@aivo/db");
    const { eq, and } = await import("drizzle-orm");
    const started = new Date(Date.now() - 1000);
    try {
      const learnerId = `learner-${Date.now()}`;
      const payload = {
        events: [
          {
            action: "admin.learner.viewed",
            resourceType: "learner",
            resourceId: learnerId,
            tenantId: tenant.id,
          },
        ],
      };

      const first = await app.inject({
        method: "POST",
        url: "/api/admin-svc/audit-log/read-events",
        headers: auth,
        payload,
      });
      assert.equal(first.statusCode, 200, first.body);
      assert.deepEqual(first.json(), { recorded: 1, deduped: 0 });

      // The refresh: same actor, same resource, inside the window.
      const second = await app.inject({
        method: "POST",
        url: "/api/admin-svc/audit-log/read-events",
        headers: auth,
        payload,
      });
      assert.equal(second.statusCode, 200, second.body);
      assert.deepEqual(second.json(), { recorded: 0, deduped: 1 });

      const platformRows = await db
        .select()
        .from(adminAuditLog)
        .where(
          and(
            eq(adminAuditLog.action, "admin.learner.viewed"),
            eq(adminAuditLog.resourceId, learnerId),
          ),
        );
      assert.equal(platformRows.length, 1, "exactly one platform trail row");
      assert.equal(platformRows[0].actorId, admin.id);
      assert.equal(platformRows[0].tenantId, tenant.id);
      assert.ok(platformRows[0].hash, "platform row is hash-chained");
      assert.deepEqual(platformRows[0].details, {}, "no content fields in details");

      const districtRows = await db
        .select()
        .from(districtActivityLog)
        .where(
          and(
            eq(districtActivityLog.action, "admin.learner.viewed"),
            eq(districtActivityLog.resourceId, learnerId),
          ),
        );
      assert.equal(districtRows.length, 1, "exactly one district trail row");
      assert.equal(districtRows[0].tenantId, tenant.id);
      assert.ok(districtRows[0].hash, "district row is hash-chained");

      // The district-facing verification answer stays YES.
      const verdict = await verifyAuditChainRange(db, "district_activity_log", {
        from: started,
      });
      assert.equal(verdict.intact, true, JSON.stringify(verdict));
      assert.ok(verdict.checkedRows >= 1);
    } finally {
      await cleanup(db, admin.id);
      await app.close();
      await closeDb();
    }
  },
);
