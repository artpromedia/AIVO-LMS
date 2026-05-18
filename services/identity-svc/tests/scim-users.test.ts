/**
 * Sprint 6: SCIM 2.0 endpoint tests — bearer auth, filter parser, role
 * rejection. The DB-backed cases skip when DATABASE_URL is missing.
 */
import { test } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { createDb } = await import("@aivo/db");
  const { registerScimRoutes } = await import("../src/routes/scim");
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify();
  (app as any).db = db;
  await registerScimRoutes(app);
  await app.ready();
  return { app, db };
}

async function teardown(app: any, db: any) {
  const { closeDb } = await import("@aivo/db");
  await app.close();
  await closeDb(db);
}

async function issueToken(db: any, tenantId: string): Promise<string> {
  const { scimTokens } = await import("@aivo/db");
  const plain = `scim_${crypto.randomBytes(24).toString("base64url")}`;
  const tokenHash = crypto.createHash("sha256").update(plain).digest("hex");
  await db.insert(scimTokens).values({
    tenantId,
    tokenHash,
    name: "test-token",
    prefix: plain.slice(0, 10),
    createdBy: null,
  } as any);
  return plain;
}

test("SCIM Users: rejects missing bearer token", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  try {
    const res = await app.inject({ method: "GET", url: "/scim/v2/Users" });
    assert.equal(res.statusCode, 401);
  } finally {
    await teardown(app, db);
  }
});

test("SCIM Users: rejects bogus bearer token", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  try {
    const res = await app.inject({
      method: "GET",
      url: "/scim/v2/Users",
      headers: { Authorization: "Bearer scim_does-not-exist" },
    });
    assert.equal(res.statusCode, 401);
  } finally {
    await teardown(app, db);
  }
});

test("SCIM Users: list returns SCIM ListResponse with valid token", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  try {
    const { tenants } = await import("@aivo/db");
    const { eq } = await import("drizzle-orm");
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: `SCIM Test ${Date.now()}`,
        type: "B2B_DISTRICT",
      } as any)
      .returning();
    const token = await issueToken(db, tenant.id);
    const res = await app.inject({
      method: "GET",
      url: "/scim/v2/Users?count=10",
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as any;
    assert.ok(Array.isArray(body.schemas));
    assert.ok(body.schemas.some((s: string) => s.includes("ListResponse")));
    assert.ok(typeof body.totalResults === "number");
    assert.ok(Array.isArray(body.Resources));

    const { scimTokens } = await import("@aivo/db");
    await db.delete(scimTokens).where(eq(scimTokens.tenantId, tenant.id));
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
  } finally {
    await teardown(app, db);
  }
});

test("SCIM Users: rejects PLATFORM_ADMIN provisioning attempts", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  try {
    const { tenants } = await import("@aivo/db");
    const { eq } = await import("drizzle-orm");
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: `SCIM Reject ${Date.now()}`,
        type: "B2B_DISTRICT",
      } as any)
      .returning();
    const token = await issueToken(db, tenant.id);
    const res = await app.inject({
      method: "POST",
      url: "/scim/v2/Users",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/scim+json" },
      payload: {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
        userName: `bad-${Date.now()}@example.org`,
        emails: [{ value: `bad-${Date.now()}@example.org`, type: "work", primary: true }],
        active: true,
        // The aivoRole attribute is the AIVO-specific extension that maps to the user role.
        aivoRole: "PLATFORM_ADMIN",
      },
    });
    assert.equal(res.statusCode, 403, "PLATFORM_ADMIN must never be SCIM-provisioned");

    const { scimTokens } = await import("@aivo/db");
    await db.delete(scimTokens).where(eq(scimTokens.tenantId, tenant.id));
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
  } finally {
    await teardown(app, db);
  }
});
