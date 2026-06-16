/**
 * Self-serve registration role/tenant provisioning (DB-backed).
 *
 * Proves: POST /api/auth/register creates the account with the persona the
 * caller picked AND provisions the matching tenant type —
 *   - PARENT          → B2C_FAMILY
 *   - TEACHER         → B2B_SCHOOL
 *   - SCHOOL_ADMIN    → B2B_SCHOOL
 *   - DISTRICT_ADMIN  → B2B_DISTRICT
 * and that an unsupported/privileged `role` value is rejected by the route
 * schema (no account, no tenant) so a tampered field can't escalate.
 *
 * Skips when DATABASE_URL is unset.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;

let cached: Awaited<ReturnType<typeof buildSetup>> | null = null;

async function buildSetup() {
  const Fastify = (await import("fastify")).default;
  const cookie = (await import("@fastify/cookie")).default;
  const { createDb } = await import("@aivo/db");
  const db = createDb(process.env.DATABASE_URL!);

  const { registerAuthRoutes } = await import("../src/routes/auth.js");
  const identity = Fastify();
  await identity.register(cookie);
  (identity as any).db = db;
  await registerAuthRoutes(identity);
  await identity.ready();

  return { identity, db };
}

async function setup() {
  if (!cached) cached = await buildSetup();
  return cached;
}

// Comfortably clears the password policy (length, mixed case, digit, symbol,
// no obvious dictionary/identity overlap).
const STRONG_PASSWORD = "S3cure-Signup-Pass!9";

async function tenantType(db: any, tenantId: string): Promise<string> {
  const { sql } = await import("drizzle-orm");
  const rows: any = await db.execute(
    sql`SELECT type FROM tenants WHERE id = ${tenantId}`,
  );
  return (Array.isArray(rows) ? rows : rows.rows)[0]?.type;
}

const ROLE_CASES: ReadonlyArray<{
  role: "PARENT" | "TEACHER" | "SCHOOL_ADMIN" | "DISTRICT_ADMIN";
  tenantType: "B2C_FAMILY" | "B2B_SCHOOL" | "B2B_DISTRICT";
}> = [
  { role: "PARENT", tenantType: "B2C_FAMILY" },
  { role: "TEACHER", tenantType: "B2B_SCHOOL" },
  { role: "SCHOOL_ADMIN", tenantType: "B2B_SCHOOL" },
  { role: "DISTRICT_ADMIN", tenantType: "B2B_DISTRICT" },
];

for (const tc of ROLE_CASES) {
  test(`register as ${tc.role} creates that role under a ${tc.tenantType} tenant`, async (t) => {
    if (SKIP) return t.skip("DATABASE_URL not set");
    const { identity, db } = await setup();
    const email = `signup-${tc.role.toLowerCase()}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2, 8)}@signup.test`;

    const res = await identity.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email, password: STRONG_PASSWORD, name: "Sam Signup", role: tc.role },
    });

    assert.equal(res.statusCode, 200, res.body);
    const body = res.json();
    assert.equal(body.user.role, tc.role, "response echoes the requested role");
    assert.ok(body.user.tenantId, "a tenant was provisioned");
    assert.ok(body.accessToken, "an access token was minted");

    // The persisted user row really carries the requested role.
    const { sql } = await import("drizzle-orm");
    const userRows: any = await db.execute(
      sql`SELECT role, tenant_id FROM users WHERE email = ${email}`,
    );
    const urow = (Array.isArray(userRows) ? userRows : userRows.rows)[0];
    assert.equal(urow.role, tc.role);
    assert.equal(urow.tenant_id, body.user.tenantId);

    // The provisioned tenant has the licensing-driving type for this persona.
    assert.equal(await tenantType(db, body.user.tenantId), tc.tenantType);
  });
}

test("rejects an unsupported/privileged role without provisioning anything", async (t) => {
  if (SKIP) return t.skip("DATABASE_URL not set");
  const { identity, db } = await setup();
  const email = `signup-escalate-${Date.now()}@signup.test`;

  const res = await identity.inject({
    method: "POST",
    url: "/api/auth/register",
    // PLATFORM_ADMIN is a privileged staff role and is NOT in the route's
    // self-serve enum — the schema must reject it outright.
    payload: { email, password: STRONG_PASSWORD, name: "Mallory", role: "PLATFORM_ADMIN" },
  });

  assert.equal(res.statusCode, 400, res.body);

  // No user row and therefore no escalated account leaked through.
  const { sql } = await import("drizzle-orm");
  const userRows: any = await db.execute(
    sql`SELECT id FROM users WHERE email = ${email}`,
  );
  assert.equal((Array.isArray(userRows) ? userRows : userRows.rows).length, 0);
});

test.after(async () => {
  if (cached) {
    const { identity, db } = cached;
    const { closeDb } = await import("@aivo/db");
    await identity.close();
    await closeDb(db);
  }
});
