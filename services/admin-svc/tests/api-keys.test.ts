/**
 * Sprint 7: API key handler tests.
 *
 * These tests assume DATABASE_URL is set (the same dev DB used by the
 * services). They exercise create → rotate → grace overlap → revoke
 * end-to-end through the Fastify handlers, using a forged JWT for
 * PLATFORM_ADMIN auth.
 */
import { test } from "node:test";
import assert from "node:assert";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { createDb, closeDb, users } = await import("@aivo/db");
  const { signJWT } = await import("@aivo/security");
  const { registerApiKeyRoutes, validateApiKey } = await import("../src/routes/api-keys");
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify();
  (app as any).db = db;
  registerApiKeyRoutes(app, db);
  await app.ready();
  // The api_keys.created_by column is an FK to users.id, so we have to
  // back the JWT with a real user row.
  const [admin] = await db.insert(users).values({
    email: `test-admin-${Date.now()}@aivo.dev`,
    name: "Test Admin",
    role: "PLATFORM_ADMIN",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  } as any).returning();
  const token = await signJWT({
    sub: admin.id,
    role: "PLATFORM_ADMIN",
    email: admin.email,
    tenantId: null,
    name: "Test Admin",
  } as any);
  const auth = { Authorization: `Bearer ${token}` };
  return { app, db, auth, adminId: admin.id, validateApiKey, closeDb };
}

async function cleanupAdmin(db: any, adminId: string) {
  const { users } = await import("@aivo/db");
  const { eq } = await import("drizzle-orm");
  await db.delete(users).where(eq(users.id, adminId)).catch(() => {});
}

test("API keys: create returns plaintext exactly once and stores argon2 hash", { skip: SKIP }, async () => {
  const { app, db, auth, adminId, validateApiKey, closeDb } = await bootstrap();
  try {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin-svc/api-keys",
      headers: auth,
      payload: { name: "test-create", scopes: ["read:users"], expiresInDays: 30 },
    });
    assert.equal(res.statusCode, 201, res.body);
    const body = res.json() as any;
    assert.ok(body.plaintext.startsWith("aivo_"));
    assert.equal(body.key.keyHash, undefined, "hash must not leak in response");
    assert.equal(body.key.scopes[0], "read:users");

    const v = await validateApiKey(db, body.plaintext);
    assert.equal(v.valid, true);
    assert.equal(v.scopes?.[0], "read:users");

    // Cleanup
    const { apiKeys } = await import("@aivo/db");
    const { eq } = await import("drizzle-orm");
    await db.delete(apiKeys).where(eq(apiKeys.id, body.key.id));
  } finally {
    await cleanupAdmin(db, adminId);
    await app.close();
    await closeDb(db);
  }
});

test("API keys: rotate keeps old key working through grace, then revoke kills it", { skip: SKIP }, async () => {
  const { app, db, auth, adminId, validateApiKey, closeDb } = await bootstrap();
  try {
    const create = await app.inject({
      method: "POST", url: "/api/admin-svc/api-keys", headers: auth,
      payload: { name: "rotate-test", scopes: ["read:users"] },
    });
    const original = create.json() as any;

    const rot = await app.inject({
      method: "POST", url: `/api/admin-svc/api-keys/${original.key.id}/rotate`, headers: auth,
    });
    assert.equal(rot.statusCode, 201, rot.body);
    const rotated = rot.json() as any;
    assert.notEqual(rotated.plaintext, original.plaintext);
    assert.equal(rotated.previousKeyId, original.key.id);

    // Both keys must validate during the grace window.
    const a = await validateApiKey(db, original.plaintext);
    const b = await validateApiKey(db, rotated.plaintext);
    assert.equal(a.valid, true, "old key should still work during grace");
    assert.equal(b.valid, true, "new key should work immediately");

    // Revoking the new key takes effect immediately.
    const rev = await app.inject({
      method: "POST", url: `/api/admin-svc/api-keys/${rotated.key.id}/revoke`, headers: auth,
    });
    assert.equal(rev.statusCode, 200);
    const c = await validateApiKey(db, rotated.plaintext);
    assert.equal(c.valid, false);

    const { apiKeys } = await import("@aivo/db");
    const { eq, or } = await import("drizzle-orm");
    await db.delete(apiKeys).where(or(eq(apiKeys.id, original.key.id), eq(apiKeys.id, rotated.key.id)));
  } finally {
    await cleanupAdmin(db, adminId);
    await app.close();
    await closeDb(db);
  }
});

test("API keys: rotate refuses when already revoked", { skip: SKIP }, async () => {
  const { app, db, auth, adminId, closeDb } = await bootstrap();
  try {
    const create = await app.inject({
      method: "POST", url: "/api/admin-svc/api-keys", headers: auth,
      payload: { name: "rotate-revoked", scopes: ["read:users"] },
    });
    const k = create.json() as any;
    await app.inject({ method: "POST", url: `/api/admin-svc/api-keys/${k.key.id}/revoke`, headers: auth });
    const rot = await app.inject({
      method: "POST", url: `/api/admin-svc/api-keys/${k.key.id}/rotate`, headers: auth,
    });
    assert.equal(rot.statusCode, 400);

    const { apiKeys } = await import("@aivo/db");
    const { eq } = await import("drizzle-orm");
    await db.delete(apiKeys).where(eq(apiKeys.id, k.key.id));
  } finally {
    await cleanupAdmin(db, adminId);
    await app.close();
    await closeDb(db);
  }
});

test("API keys: rejects requests without PLATFORM_ADMIN role", { skip: SKIP }, async () => {
  const { app, db, adminId, closeDb } = await bootstrap();
  try {
    const { signJWT } = await import("@aivo/security");
    const teacherToken = await signJWT({
      sub: "tch-1", role: "TEACHER", email: "t@example.org", tenantId: null, name: "T",
    } as any);
    const res = await app.inject({
      method: "GET", url: "/api/admin-svc/api-keys",
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert.equal(res.statusCode, 403);
  } finally {
    await cleanupAdmin(db, adminId);
    await app.close();
    await closeDb(db);
  }
});
