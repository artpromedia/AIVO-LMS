import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;

let cached: Awaited<ReturnType<typeof buildSetup>> | null = null;

async function buildSetup() {
  const Fastify = (await import("fastify")).default;
  const cookie = (await import("@fastify/cookie")).default;
  const { createDb } = await import("@aivo/db");
  const db = createDb(process.env.DATABASE_URL!);
  const { registerUserRoutes } = await import("../src/routes/users.js");
  const { registerAuthRoutes } = await import("../src/routes/auth.js");
  const app = Fastify();
  await app.register(cookie);
  (app as any).db = db;
  await registerUserRoutes(app);
  await registerAuthRoutes(app);
  await app.ready();
  return { app, db };
}

async function setup() {
  if (!cached) cached = await buildSetup();
  return cached;
}

async function seedParent(db: any) {
  const { tenants, users } = await import("@aivo/db");
  const { signJWT } = await import("@aivo/security");
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const [tenant] = await db
    .insert(tenants)
    .values({ name: `PIN Tenant ${stamp}`, type: "B2C_FAMILY", licensingTier: "B2B_SEAT_LICENSED" } as any)
    .returning();
  const [parent] = await db
    .insert(users)
    .values({
      email: `pin-parent-${stamp}@example.test`,
      name: "PIN Parent",
      role: "PARENT",
      tenantId: tenant.id,
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    } as any)
    .returning();
  const token = await signJWT({
    sub: parent.id,
    role: "PARENT",
    tenantId: tenant.id,
    email: parent.email,
    name: parent.name,
  } as any);
  return { tenant, parent, token };
}

test("learner PINs are hashed, learner-bound, and lock out after repeated failures", async (t) => {
  if (SKIP) return t.skip("DATABASE_URL not set");
  const { app, db } = await setup();
  const { sql } = await import("drizzle-orm");
  const { token, parent } = await seedParent(db);

  const createA = await app.inject({
    method: "POST",
    url: "/api/users/learners",
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "Learner A", pin: "1234" },
  });
  assert.equal(createA.statusCode, 200, createA.body);
  const learnerA = createA.json().learner;

  const createB = await app.inject({
    method: "POST",
    url: "/api/users/learners",
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "Learner B", pin: "1234" },
  });
  assert.equal(createB.statusCode, 200, createB.body);
  const learnerB = createB.json().learner;

  const plaintextRows: any = await db.execute(
    sql`SELECT count(*)::int AS n FROM users WHERE role = 'LEARNER' AND pin ~ '^[0-9]{4,6}$'`,
  );
  assert.equal((Array.isArray(plaintextRows) ? plaintextRows : plaintextRows.rows)[0].n, 0);

  const credentialRows: any = await db.execute(
    sql`SELECT pin_hash FROM learner_pin_credentials WHERE learner_user_id = ${learnerA.userId}`,
  );
  const credential = (Array.isArray(credentialRows) ? credentialRows : credentialRows.rows)[0];
  assert.ok(String(credential.pin_hash).startsWith("$argon2"));
  assert.notEqual(credential.pin_hash, "1234");

  const valid = await app.inject({
    method: "POST",
    url: "/api/auth/pin-login",
    payload: { parentId: parent.id, learnerId: learnerA.id, pin: "1234" },
  });
  assert.equal(valid.statusCode, 200, valid.body);
  assert.equal(valid.json().user.learnerId, learnerA.id);

  const wrongSelectedLearner = await app.inject({
    method: "POST",
    url: "/api/auth/pin-login",
    payload: { parentId: parent.id, learnerId: learnerB.id, pin: "9999" },
  });
  assert.equal(wrongSelectedLearner.statusCode, 401, wrongSelectedLearner.body);

  let lockedStatus = 0;
  for (let i = 0; i < 5; i++) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/pin-login",
      payload: { parentId: parent.id, learnerId: learnerB.id, pin: "0000" },
    });
    lockedStatus = res.statusCode;
  }
  assert.equal(lockedStatus, 429);

  const locked = await app.inject({
    method: "POST",
    url: "/api/auth/pin-login",
    payload: { parentId: parent.id, learnerId: learnerB.id, pin: "1234" },
  });
  assert.equal(locked.statusCode, 429, locked.body);
  assert.ok(Number(locked.json().retryAfterSeconds) > 0);
});
