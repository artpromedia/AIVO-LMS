/**
 * Sprint B5 — shared roster-apply core + the /internal/roster endpoints
 * (the identity half of integration-svc's HttpRosterWriter contract,
 * which previously 404'd). Proves SCIM and the SIS pipeline converge on
 * one provisioning path. Skips without DATABASE_URL.
 */
import { test } from "node:test";
import assert from "node:assert";

const SKIP = !process.env.DATABASE_URL;
const SERVICE_TOKEN = "roster-core-test-token";

async function bootstrap() {
  process.env.INTERNAL_SERVICE_TOKEN = SERVICE_TOKEN;
  const Fastify = (await import("fastify")).default;
  const { createDb, tenants } = await import("@aivo/db");
  const { registerInternalRosterRoutes } = await import("../src/routes/internal-roster");
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify();
  registerInternalRosterRoutes(app, db);
  await app.ready();
  const [tenant] = await db
    .insert(tenants)
    .values({ name: `Roster Core District ${Date.now()}`, type: "B2B_DISTRICT" } as any)
    .returning();
  return { app, db, tenant };
}

async function teardown(app: any, db: any) {
  const { closeDb } = await import("@aivo/db");
  await app.close();
  await closeDb(db);
}

test("parseClassGroupName follows the documented convention strictly", async () => {
  const { parseClassGroupName } = await import("../src/services/roster-core");
  assert.deepEqual(parseClassGroupName("Class: Lincoln Elementary / Grade 3 - Room B"), {
    schoolName: "Lincoln Elementary",
    className: "Grade 3 - Room B",
  });
  assert.deepEqual(parseClassGroupName("class:  Jefferson MS  /  Algebra 1 "), {
    schoolName: "Jefferson MS",
    className: "Algebra 1",
  });
  assert.equal(parseClassGroupName("Everyone"), null);
  assert.equal(parseClassGroupName("Class: MissingSlash"), null);
  assert.equal(parseClassGroupName("Class: / NoSchool"), null);
});

test("applyUserUpsert: creates, adopts by externalId, refuses escalation", { skip: SKIP }, async () => {
  const { app, db, tenant } = await bootstrap();
  const { applyUserUpsert } = await import("../src/services/roster-core");
  try {
    const email = `core-${Date.now()}@roster.test`;
    const created = await applyUserUpsert(db, {
      tenantId: tenant.id,
      email,
      name: "Core Teacher",
      role: "TEACHER",
      externalId: `sis-${Date.now()}`,
      provisionedBy: "sis",
    });
    assert.ok(created.ok && created.created, JSON.stringify(created));

    // Same externalId with a NEW email = same account updated (re-keyed
    // email must not duplicate the user).
    const rekeyed = await applyUserUpsert(db, {
      tenantId: tenant.id,
      email: `renamed-${email}`,
      name: "Core Teacher",
      role: "TEACHER",
      externalId: (created as any).user.externalId,
      provisionedBy: "sis",
    });
    assert.ok(rekeyed.ok && !rekeyed.created);
    assert.equal((rekeyed as any).user.id, (created as any).user.id);
    assert.equal((rekeyed as any).user.email, `renamed-${email}`);

    const escalation = await applyUserUpsert(db, {
      tenantId: tenant.id,
      email: `evil-${email}`,
      name: "Evil",
      role: "PLATFORM_ADMIN",
      provisionedBy: "sis",
    });
    assert.ok(!escalation.ok);
    assert.equal((escalation as any).error.status, 403);
  } finally {
    await teardown(app, db);
  }
});

test("internal roster endpoints: service-token gate + canonical apply + student refusal", { skip: SKIP }, async () => {
  const { app, db, tenant } = await bootstrap();
  const { users } = await import("@aivo/db");
  const { eq } = await import("drizzle-orm");
  try {
    const sourcedId = `or-${Date.now()}`;
    const email = `pipeline-${Date.now()}@roster.test`;
    const record = {
      sourcedId,
      enabled: true,
      givenName: "Pipe",
      familyName: "Line",
      email,
      primaryRole: "teacher",
      status: "active",
    };

    // No/wrong token → refused.
    const noAuth = await app.inject({
      method: "POST",
      url: "/internal/roster/users/upsert",
      payload: { tenantId: tenant.id, provider: "oneroster", record },
    });
    assert.equal(noAuth.statusCode, 401);

    const ok = await app.inject({
      method: "POST",
      url: "/internal/roster/users/upsert",
      headers: { authorization: `Bearer ${SERVICE_TOKEN}` },
      payload: { tenantId: tenant.id, provider: "oneroster", record },
    });
    assert.equal(ok.statusCode, 200, ok.body);
    assert.equal((ok.json() as any).created, true);

    const [row] = await db.select().from(users).where(eq(users.externalId, sourcedId)).limit(1);
    assert.equal(row.role, "TEACHER");
    assert.equal(row.provisionedBy, "sis");

    // Students are explicitly refused (learners roster via enrollments).
    const student = await app.inject({
      method: "POST",
      url: "/internal/roster/users/upsert",
      headers: { authorization: `Bearer ${SERVICE_TOKEN}` },
      payload: {
        tenantId: tenant.id,
        provider: "oneroster",
        record: { ...record, sourcedId: `${sourcedId}-s`, primaryRole: "student" },
      },
    });
    assert.equal(student.statusCode, 422);
    assert.match(student.body, /studentsNotUsers/);

    // Soft-deactivate via the writer's deactivate path; reactivation via
    // a fresh upsert (IdP/SIS re-asserting the user).
    const deactivate = await app.inject({
      method: "POST",
      url: "/internal/roster/users/deactivate",
      headers: { authorization: `Bearer ${SERVICE_TOKEN}` },
      payload: { tenantId: tenant.id, provider: "oneroster", sourcedId, effectiveDate: new Date().toISOString() },
    });
    assert.equal(deactivate.statusCode, 200, deactivate.body);
    const [offRow] = await db.select().from(users).where(eq(users.externalId, sourcedId)).limit(1);
    assert.ok(offRow.deactivatedAt, "soft-deleted, row retained");

    const reupsert = await app.inject({
      method: "POST",
      url: "/internal/roster/users/upsert",
      headers: { authorization: `Bearer ${SERVICE_TOKEN}` },
      payload: { tenantId: tenant.id, provider: "oneroster", record },
    });
    assert.equal(reupsert.statusCode, 200);
    const [onRow] = await db.select().from(users).where(eq(users.externalId, sourcedId)).limit(1);
    assert.equal(onRow.deactivatedAt, null, "re-asserted user reactivates");
  } finally {
    await teardown(app, db);
  }
});

test("OneRoster enabled:false on upsert maps to deactivation", { skip: SKIP }, async () => {
  const { app, db, tenant } = await bootstrap();
  const { users } = await import("@aivo/db");
  const { eq } = await import("drizzle-orm");
  try {
    const sourcedId = `or-flag-${Date.now()}`;
    const base = {
      sourcedId,
      givenName: "Flag",
      familyName: "Case",
      email: `flag-${Date.now()}@roster.test`,
      primaryRole: "administrator",
    };
    await app.inject({
      method: "POST",
      url: "/internal/roster/users/upsert",
      headers: { authorization: `Bearer ${SERVICE_TOKEN}` },
      payload: { tenantId: tenant.id, provider: "oneroster", record: { ...base, enabled: true } },
    });
    const off = await app.inject({
      method: "POST",
      url: "/internal/roster/users/upsert",
      headers: { authorization: `Bearer ${SERVICE_TOKEN}` },
      payload: { tenantId: tenant.id, provider: "oneroster", record: { ...base, enabled: false } },
    });
    assert.equal(off.statusCode, 200, off.body);
    assert.equal((off.json() as any).deactivated, true);
    const [row] = await db.select().from(users).where(eq(users.externalId, sourcedId)).limit(1);
    assert.equal(row.role, "DISTRICT_ADMIN", "administrator mapped");
    assert.ok(row.deactivatedAt);
  } finally {
    await teardown(app, db);
  }
});
