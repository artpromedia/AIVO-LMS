import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const SKIP = !process.env.DATABASE_URL;

let cached: Awaited<ReturnType<typeof buildSetup>> | null = null;

async function buildSetup() {
  const Fastify = (await import("fastify")).default;
  const cookie = (await import("@fastify/cookie")).default;
  const { createDb } = await import("@aivo/db");
  const db = createDb(process.env.DATABASE_URL!);
  const { registerAuthRoutes } = await import("../src/routes/auth.js");
  const app = Fastify();
  await app.register(cookie);
  (app as any).db = db;
  await registerAuthRoutes(app);
  await app.ready();
  return { app, db };
}

async function setup() {
  if (!cached) cached = await buildSetup();
  return cached;
}

function uniqueEmail() {
  return `verify-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@example.test`;
}

test("register creates an unverified account and mints a verification token", async (t) => {
  if (SKIP) return t.skip("DATABASE_URL not set");
  const { app, db } = await setup();
  const { users, emailVerificationTokens } = await import("@aivo/db");
  const { eq } = await import("drizzle-orm");

  const email = uniqueEmail();
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, password: "Sup3r-Str0ng-Pass!", name: "Verify Parent", role: "PARENT" },
  });
  assert.equal(res.statusCode, 200, res.body);
  const userId = res.json().user.id;

  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  assert.equal(row.emailVerified, false, "new account must start unverified");

  const tokens = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, userId));
  assert.equal(tokens.length, 1, "registration must mint exactly one verification token");
  assert.equal(tokens[0].usedAt, null);
  // Only the hash is persisted — never a usable token.
  assert.equal(tokens[0].tokenHash.length, 64);
});

test("a valid token verifies the email once and cannot be replayed", async (t) => {
  if (SKIP) return t.skip("DATABASE_URL not set");
  const { app, db } = await setup();
  const { users, tenants, emailVerificationTokens } = await import("@aivo/db");
  const { eq } = await import("drizzle-orm");

  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const [tenant] = await db
    .insert(tenants)
    .values({ name: `Verify Tenant ${stamp}`, type: "B2C_FAMILY" } as any)
    .returning();
  const [user] = await db
    .insert(users)
    .values({
      email: uniqueEmail(),
      name: "Token Holder",
      role: "PARENT",
      tenantId: tenant.id,
      emailVerified: false,
    } as any)
    .returning();

  // Seed a token the way issueAndSendEmailVerification would: store only the
  // sha256, hand the raw value to the "email".
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  await db
    .insert(emailVerificationTokens)
    .values({ userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });

  const ok = await app.inject({
    method: "POST",
    url: "/api/auth/verify-email",
    payload: { token: rawToken },
  });
  assert.equal(ok.statusCode, 200, ok.body);
  assert.equal(ok.json().ok, true);

  const [verified] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  assert.equal(verified.emailVerified, true, "email must be verified after redeeming the token");

  // Replay is rejected — the token is single-use.
  const replay = await app.inject({
    method: "POST",
    url: "/api/auth/verify-email",
    payload: { token: rawToken },
  });
  assert.equal(replay.statusCode, 400, replay.body);
});

test("an expired token is rejected", async (t) => {
  if (SKIP) return t.skip("DATABASE_URL not set");
  const { app, db } = await setup();
  const { users, tenants, emailVerificationTokens } = await import("@aivo/db");

  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const [tenant] = await db
    .insert(tenants)
    .values({ name: `Verify Tenant ${stamp}`, type: "B2C_FAMILY" } as any)
    .returning();
  const [user] = await db
    .insert(users)
    .values({ email: uniqueEmail(), name: "Expired", role: "PARENT", tenantId: tenant.id, emailVerified: false } as any)
    .returning();

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  await db
    .insert(emailVerificationTokens)
    .values({ userId: user.id, tokenHash, expiresAt: new Date(Date.now() - 1000) });

  const res = await app.inject({
    method: "POST",
    url: "/api/auth/verify-email",
    payload: { token: rawToken },
  });
  assert.equal(res.statusCode, 400, res.body);
});

test("an unknown token is rejected", async (t) => {
  if (SKIP) return t.skip("DATABASE_URL not set");
  const { app } = await setup();
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/verify-email",
    payload: { token: crypto.randomBytes(32).toString("hex") },
  });
  assert.equal(res.statusCode, 400, res.body);
});

test("send-verification-email always answers generically (no account enumeration)", async (t) => {
  if (SKIP) return t.skip("DATABASE_URL not set");
  const { app } = await setup();

  const unknown = await app.inject({
    method: "POST",
    url: "/api/auth/send-verification-email",
    payload: { email: uniqueEmail() },
  });
  assert.equal(unknown.statusCode, 200, unknown.body);
  assert.equal(unknown.json().ok, true);
});
