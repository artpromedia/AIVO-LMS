/**
 * Sprint 1 (invite-flows): staff invite acceptance endpoint tests.
 *
 * Covers GET /api/auth/invite/:token (preview) and
 * POST /api/auth/accept-invite (create account + auto-login). These are the
 * production token-acceptance step for DISTRICT_ADMIN / SCHOOL_ADMIN /
 * TEACHER invites created via the admin consoles.
 *
 * DB-backed; skips when DATABASE_URL is unset (mirrors the other
 * identity-svc tests).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const SKIP = !process.env.DATABASE_URL;

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const cookie = (await import("@fastify/cookie")).default;
  const { createDb } = await import("@aivo/db");
  const { registerAuthRoutes } = await import("../src/routes/auth");
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify();
  await app.register(cookie);
  (app as any).db = db;
  await registerAuthRoutes(app);
  await app.ready();
  return { app, db };
}

async function teardown(app: any, db: any) {
  const { closeDb } = await import("@aivo/db");
  await app.close();
  await closeDb(db);
}

type Seed = {
  tenantId: string;
  inviterId: string;
  schoolId: string | null;
  inviteId: string;
  rawToken: string;
  email: string;
};

async function seedInvite(
  db: any,
  opts: {
    role: string;
    withSchool?: boolean;
    expiresAt?: Date;
    acceptedAt?: Date;
    revokedAt?: Date;
  },
): Promise<Seed> {
  const { tenants, schools, users, districtAdminInvites } = await import("@aivo/db");
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: `Invite Test ${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      type: "B2B_DISTRICT",
    } as any)
    .returning();
  const [inviter] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      email: `inviter+${crypto.randomBytes(4).toString("hex")}@example.com`,
      name: "Inviter Admin",
      role: "DISTRICT_ADMIN",
    } as any)
    .returning();
  let schoolId: string | null = null;
  if (opts.withSchool) {
    const [school] = await db
      .insert(schools)
      .values({ tenantId: tenant.id, name: "Lincoln Elementary" } as any)
      .returning();
    schoolId = school.id;
  }
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const email = `invitee+${crypto.randomBytes(4).toString("hex")}@example.com`;
  const [invite] = await db
    .insert(districtAdminInvites)
    .values({
      tenantId: tenant.id,
      email,
      name: "New Staffer",
      role: opts.role,
      schoolId,
      invitedBy: inviter.id,
      tokenHash: hashToken(rawToken),
      expiresAt: opts.expiresAt ?? new Date(Date.now() + 72 * 3600 * 1000),
      acceptedAt: opts.acceptedAt ?? null,
      revokedAt: opts.revokedAt ?? null,
    } as any)
    .returning();
  return {
    tenantId: tenant.id,
    inviterId: inviter.id,
    schoolId,
    inviteId: invite.id,
    rawToken,
    email,
  };
}

async function cleanup(db: any, seed: Seed) {
  const {
    tenants,
    schools,
    users,
    districtAdminInvites,
    sessions,
    passwordHistory,
    adminAuditLog,
  } = await import("@aivo/db");
  const { eq } = await import("drizzle-orm");
  // Only mutable rows are removed. The admin audit ledger is append-only
  // (hash-chained, UPDATE/DELETE blocked by trigger — that is the product
  // guarantee, and tests must live with it), and its tenant FK pins the
  // tenant row, so audit/users/schools/tenants stay. Every fixture uses a
  // unique email + tenant name, so retained rows cannot collide.
  await db.delete(districtAdminInvites).where(eq(districtAdminInvites.tenantId, seed.tenantId));
  const tenantUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.tenantId, seed.tenantId));
  for (const u of tenantUsers) {
    await db.delete(passwordHistory).where(eq(passwordHistory.userId, u.id));
    await db.delete(sessions).where(eq(sessions.userId, u.id));
  }
  void adminAuditLog;
  void schools;
  void tenants;
}

test(
  "invite preview: returns invitee + school for a valid SCHOOL_ADMIN token",
  { skip: SKIP },
  async () => {
    const { app, db } = await bootstrap();
    const seed = await seedInvite(db, { role: "SCHOOL_ADMIN", withSchool: true });
    try {
      const res = await app.inject({ method: "GET", url: `/api/auth/invite/${seed.rawToken}` });
      assert.equal(res.statusCode, 200);
      const body = res.json() as any;
      assert.equal(body.invite.email, seed.email);
      assert.equal(body.invite.role, "SCHOOL_ADMIN");
      assert.equal(body.invite.schoolName, "Lincoln Elementary");
    } finally {
      await cleanup(db, seed);
      await teardown(app, db);
    }
  },
);

test("invite preview: rejects an unknown token", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  try {
    const res = await app.inject({
      method: "GET",
      url: `/api/auth/invite/${crypto.randomBytes(32).toString("base64url")}`,
    });
    assert.equal(res.statusCode, 400);
  } finally {
    await teardown(app, db);
  }
});

test(
  "accept-invite: creates the account, accepts the invite, and auto-logs in",
  { skip: SKIP },
  async () => {
    const { app, db } = await bootstrap();
    const seed = await seedInvite(db, { role: "SCHOOL_ADMIN", withSchool: true });
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/accept-invite",
        payload: { token: seed.rawToken, password: "Str0ng-Passw0rd!42xz" },
      });
      assert.equal(res.statusCode, 200);
      const body = res.json() as any;
      assert.equal(body.ok, true);
      assert.ok(typeof body.accessToken === "string" && body.accessToken.length > 0);
      assert.equal(body.user.email, seed.email);
      assert.equal(body.user.role, "SCHOOL_ADMIN");
      assert.equal(body.user.schoolId, seed.schoolId);
      // Refresh cookie set for the new session.
      assert.ok(String(res.headers["set-cookie"] ?? "").includes("refreshToken="));

      // The user row exists and the invite is marked accepted.
      const { users, districtAdminInvites } = await import("@aivo/db");
      const { eq } = await import("drizzle-orm");
      const [created] = await db.select().from(users).where(eq(users.id, body.user.id)).limit(1);
      assert.ok(created);
      assert.equal(created.role, "SCHOOL_ADMIN");
      assert.equal(created.schoolId, seed.schoolId);
      assert.equal(created.mustChangePassword, false);
      const [invite] = await db
        .select()
        .from(districtAdminInvites)
        .where(eq(districtAdminInvites.id, seed.inviteId))
        .limit(1);
      assert.ok(invite.acceptedAt);
      assert.equal(invite.acceptedUserId, body.user.id);
    } finally {
      await cleanup(db, seed);
      await teardown(app, db);
    }
  },
);

test(
  "accept-invite: a second acceptance with the same token is rejected",
  { skip: SKIP },
  async () => {
    const { app, db } = await bootstrap();
    const seed = await seedInvite(db, { role: "DISTRICT_ADMIN" });
    try {
      const first = await app.inject({
        method: "POST",
        url: "/api/auth/accept-invite",
        payload: { token: seed.rawToken, password: "Str0ng-Passw0rd!42xz" },
      });
      assert.equal(first.statusCode, 200);
      const second = await app.inject({
        method: "POST",
        url: "/api/auth/accept-invite",
        payload: { token: seed.rawToken, password: "An0ther-Passw0rd!42xz" },
      });
      assert.equal(second.statusCode, 409);
    } finally {
      await cleanup(db, seed);
      await teardown(app, db);
    }
  },
);

test("accept-invite: an expired invite is rejected with 410", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const seed = await seedInvite(db, { role: "TEACHER", expiresAt: new Date(Date.now() - 1000) });
  try {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/accept-invite",
      payload: { token: seed.rawToken, password: "Str0ng-Passw0rd!42xz" },
    });
    assert.equal(res.statusCode, 410);
  } finally {
    await cleanup(db, seed);
    await teardown(app, db);
  }
});

test("accept-invite: a revoked invite is rejected", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const seed = await seedInvite(db, { role: "DISTRICT_ADMIN", revokedAt: new Date() });
  try {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/accept-invite",
      payload: { token: seed.rawToken, password: "Str0ng-Passw0rd!42xz" },
    });
    assert.equal(res.statusCode, 400);
  } finally {
    await cleanup(db, seed);
    await teardown(app, db);
  }
});

test("accept-invite: a weak password is rejected by policy", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const seed = await seedInvite(db, { role: "SCHOOL_ADMIN", withSchool: true });
  try {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/accept-invite",
      payload: { token: seed.rawToken, password: "password" },
    });
    assert.equal(res.statusCode, 400);
  } finally {
    await cleanup(db, seed);
    await teardown(app, db);
  }
});
