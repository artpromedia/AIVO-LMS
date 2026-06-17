/**
 * Join-organization endpoint tests (task: staff join existing school/district).
 *
 * Covers POST /api/auth/join-organization — the authenticated step that moves
 * an ALREADY self-registered staff account out of the throwaway tenant created
 * at signup and into the existing org tenant the invite code belongs to,
 * without standing up a duplicate org.
 *
 * DB-backed; skips when DATABASE_URL is unset (mirrors the other identity-svc
 * tests).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const SKIP = !process.env.DATABASE_URL;
const STRONG_PASSWORD = "Str0ng-Passw0rd!42xz";

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
  orgTenantId: string;
  schoolId: string | null;
  inviteId: string;
  rawToken: string;
  inviteEmail: string;
};

/** Seed an existing org tenant (+ optional school) with a pending invite. */
async function seedOrgInvite(
  db: any,
  opts: { role: string; withSchool?: boolean; email?: string },
): Promise<Seed> {
  const { tenants, schools, users, districtAdminInvites } = await import("@aivo/db");
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: `Join Test Org ${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
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
  const inviteEmail = opts.email ?? `invitee+${crypto.randomBytes(4).toString("hex")}@example.com`;
  const [invite] = await db
    .insert(districtAdminInvites)
    .values({
      tenantId: tenant.id,
      email: inviteEmail,
      name: "New Staffer",
      role: opts.role,
      schoolId,
      invitedBy: inviter.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
    } as any)
    .returning();
  return { orgTenantId: tenant.id, schoolId, inviteId: invite.id, rawToken, inviteEmail };
}

/** Self-register a staff account (its own throwaway tenant) and return token + ids. */
async function registerStaff(app: any, email: string, role: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Self Signup", email, password: STRONG_PASSWORD, role },
  });
  assert.equal(res.statusCode, 200, `register failed: ${res.body}`);
  const body = res.json() as any;
  return {
    accessToken: body.accessToken as string,
    userId: body.user.id as string,
    ownTenantId: body.user.tenantId as string,
  };
}

async function cleanup(db: any, seed: Seed, extraTenantIds: string[] = []) {
  const { tenants, users, districtAdminInvites, sessions, passwordHistory } = await import(
    "@aivo/db"
  );
  const { eq, inArray } = await import("drizzle-orm");
  const tenantIds = [seed.orgTenantId, ...extraTenantIds];
  await db.delete(districtAdminInvites).where(inArray(districtAdminInvites.tenantId, tenantIds));
  const tenantUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.tenantId, tenantIds));
  for (const u of tenantUsers) {
    await db.delete(passwordHistory).where(eq(passwordHistory.userId, u.id));
    await db.delete(sessions).where(eq(sessions.userId, u.id));
  }
  // Org tenant + users + audit ledger stay (append-only audit pins the tenant
  // FK, matching the accept-invite test's constraints). Every fixture uses a
  // unique email + tenant name so retained rows cannot collide.
  void tenants;
}

test(
  "join-organization: moves the account into the org tenant + school + role",
  { skip: SKIP },
  async () => {
    const { app, db } = await bootstrap();
    const seed = await seedOrgInvite(db, { role: "SCHOOL_ADMIN", withSchool: true });
    const staff = await registerStaff(app, seed.inviteEmail, "TEACHER");
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/join-organization",
        headers: { authorization: `Bearer ${staff.accessToken}` },
        payload: { code: seed.rawToken, email: seed.inviteEmail },
      });
      assert.equal(res.statusCode, 200, `join failed: ${res.body}`);
      const body = res.json() as any;
      assert.equal(body.ok, true);
      assert.ok(typeof body.accessToken === "string" && body.accessToken.length > 0);
      assert.equal(body.user.id, staff.userId);
      assert.equal(body.user.tenantId, seed.orgTenantId);
      assert.equal(body.user.role, "SCHOOL_ADMIN");
      assert.equal(body.user.schoolId, seed.schoolId);
      assert.ok(String(res.headers["set-cookie"] ?? "").includes("refreshToken="));

      const { users, tenants, districtAdminInvites } = await import("@aivo/db");
      const { eq } = await import("drizzle-orm");
      // The user row actually moved.
      const [moved] = await db.select().from(users).where(eq(users.id, staff.userId)).limit(1);
      assert.equal(moved.tenantId, seed.orgTenantId);
      assert.equal(moved.role, "SCHOOL_ADMIN");
      // The throwaway self-serve tenant was torn down — no duplicate org.
      const orphan = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, staff.ownTenantId))
        .limit(1);
      assert.equal(orphan.length, 0);
      // Invite consumed.
      const [invite] = await db
        .select()
        .from(districtAdminInvites)
        .where(eq(districtAdminInvites.id, seed.inviteId))
        .limit(1);
      assert.ok(invite.acceptedAt);
      assert.equal(invite.acceptedUserId, staff.userId);
    } finally {
      await cleanup(db, seed, [staff.ownTenantId]);
      await teardown(app, db);
    }
  },
);

test("join-organization: requires authentication", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const seed = await seedOrgInvite(db, { role: "TEACHER" });
  try {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/join-organization",
      payload: { code: seed.rawToken, email: seed.inviteEmail },
    });
    assert.equal(res.statusCode, 401);
  } finally {
    await cleanup(db, seed);
    await teardown(app, db);
  }
});

test("join-organization: rejects an unknown code", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const email = `solo+${crypto.randomBytes(4).toString("hex")}@example.com`;
  const staff = await registerStaff(app, email, "TEACHER");
  try {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/join-organization",
      headers: { authorization: `Bearer ${staff.accessToken}` },
      payload: { code: crypto.randomBytes(32).toString("base64url"), email },
    });
    assert.equal(res.statusCode, 400);
  } finally {
    const { users, sessions, passwordHistory } = await import("@aivo/db");
    const { eq } = await import("drizzle-orm");
    await db.delete(passwordHistory).where(eq(passwordHistory.userId, staff.userId));
    await db.delete(sessions).where(eq(sessions.userId, staff.userId));
    void users;
    await teardown(app, db);
  }
});

test(
  "join-organization: rejects when the invite was sent to a different email",
  { skip: SKIP },
  async () => {
    const { app, db } = await bootstrap();
    const seed = await seedOrgInvite(db, { role: "SCHOOL_ADMIN", withSchool: true });
    // Account self-registered under a DIFFERENT address than the invite.
    const otherEmail = `other+${crypto.randomBytes(4).toString("hex")}@example.com`;
    const staff = await registerStaff(app, otherEmail, "TEACHER");
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/join-organization",
        headers: { authorization: `Bearer ${staff.accessToken}` },
        payload: { code: seed.rawToken, email: otherEmail },
      });
      assert.equal(res.statusCode, 403);
      // The account stayed in its own tenant — no move on a failed check.
      const { users } = await import("@aivo/db");
      const { eq } = await import("drizzle-orm");
      const [unchanged] = await db.select().from(users).where(eq(users.id, staff.userId)).limit(1);
      assert.equal(unchanged.tenantId, staff.ownTenantId);
    } finally {
      await cleanup(db, seed, [staff.ownTenantId]);
      await teardown(app, db);
    }
  },
);

test("join-organization: an expired code is rejected with 410", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const { tenants, schools, users, districtAdminInvites } = await import("@aivo/db");
  const email = `exp+${crypto.randomBytes(4).toString("hex")}@example.com`;
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: `Join Exp Org ${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      type: "B2B_SCHOOL",
    } as any)
    .returning();
  const [inviter] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      email: `inviter+${crypto.randomBytes(4).toString("hex")}@example.com`,
      name: "Inviter",
      role: "SCHOOL_ADMIN",
    } as any)
    .returning();
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const [invite] = await db
    .insert(districtAdminInvites)
    .values({
      tenantId: tenant.id,
      email,
      name: "New Staffer",
      role: "TEACHER",
      invitedBy: inviter.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() - 1000),
    } as any)
    .returning();
  const staff = await registerStaff(app, email, "TEACHER");
  try {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/join-organization",
      headers: { authorization: `Bearer ${staff.accessToken}` },
      payload: { code: rawToken, email },
    });
    assert.equal(res.statusCode, 410);
  } finally {
    const { sessions, passwordHistory } = await import("@aivo/db");
    const { eq, inArray } = await import("drizzle-orm");
    await db.delete(districtAdminInvites).where(eq(districtAdminInvites.id, invite.id));
    const tu = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.tenantId, [tenant.id, staff.ownTenantId]));
    for (const u of tu) {
      await db.delete(passwordHistory).where(eq(passwordHistory.userId, u.id));
      await db.delete(sessions).where(eq(sessions.userId, u.id));
    }
    void schools;
    await teardown(app, db);
  }
});
