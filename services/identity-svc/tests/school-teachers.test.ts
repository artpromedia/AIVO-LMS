/**
 * Sprint 1 (invite-flows): school-admin teacher management tests.
 *
 * Covers POST /api/school/teachers (invite a teacher), the requireSchoolAdmin
 * guard, and duplicate handling. DB-backed; skips when DATABASE_URL is unset.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { createDb } = await import("@aivo/db");
  const { registerSchoolRoutes } = await import("../src/routes/school");
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify();
  (app as any).db = db;
  await registerSchoolRoutes(app);
  await app.ready();
  return { app, db };
}

async function teardown(app: any, db: any) {
  const { closeDb } = await import("@aivo/db");
  await app.close();
  await closeDb(db);
}

async function seed(db: any) {
  const { tenants, schools, users } = await import("@aivo/db");
  const [tenant] = await db
    .insert(tenants)
    .values({ name: `School Test ${Date.now()}-${crypto.randomBytes(3).toString("hex")}`, type: "B2B_DISTRICT" } as any)
    .returning();
  const [school] = await db
    .insert(schools)
    .values({ tenantId: tenant.id, name: "Maple High" } as any)
    .returning();
  const [admin] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      email: `sa+${crypto.randomBytes(4).toString("hex")}@example.com`,
      name: "School Admin",
      role: "SCHOOL_ADMIN",
      schoolId: school.id,
    } as any)
    .returning();
  return { tenantId: tenant.id, schoolId: school.id, admin };
}

async function cleanup(db: any, tenantId: string) {
  const { tenants, schools, users, districtAdminInvites, adminAuditLog } = await import("@aivo/db");
  const { eq } = await import("drizzle-orm");
  await db.delete(districtAdminInvites).where(eq(districtAdminInvites.tenantId, tenantId));
  await db.delete(adminAuditLog).where(eq(adminAuditLog.tenantId, tenantId));
  await db.delete(users).where(eq(users.tenantId, tenantId));
  await db.delete(schools).where(eq(schools.tenantId, tenantId));
  await db.delete(tenants).where(eq(tenants.id, tenantId));
}

async function schoolAdminToken(admin: any, schoolId: string, tenantId: string) {
  const { signJWT } = await import("@aivo/security");
  return signJWT({
    sub: admin.id,
    tenantId,
    role: "SCHOOL_ADMIN",
    email: admin.email,
    name: admin.name,
    schoolId,
  });
}

test("school teachers: a school admin can invite a teacher (role=TEACHER, scoped to the school)", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const { tenantId, schoolId, admin } = await seed(db);
  try {
    const token = await schoolAdminToken(admin, schoolId, tenantId);
    const email = `teacher+${crypto.randomBytes(4).toString("hex")}@example.com`;
    const res = await app.inject({
      method: "POST",
      url: "/api/school/teachers",
      headers: { Authorization: `Bearer ${token}` },
      payload: { email, name: "Pat Teacher" },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as any;
    assert.equal(body.invite.role, "TEACHER");
    assert.equal(body.invite.schoolId, schoolId);

    const { districtAdminInvites } = await import("@aivo/db");
    const { eq, and } = await import("drizzle-orm");
    const [row] = await db
      .select()
      .from(districtAdminInvites)
      .where(and(eq(districtAdminInvites.id, body.invite.id)))
      .limit(1);
    assert.equal(row.role, "TEACHER");
    assert.equal(row.schoolId, schoolId);
    assert.equal(row.email, email);
    assert.ok(!row.acceptedAt);
  } finally {
    await cleanup(db, tenantId);
    await teardown(app, db);
  }
});

test("school teachers: a TEACHER token is rejected by the guard", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const { tenantId, schoolId, admin } = await seed(db);
  try {
    const { signJWT } = await import("@aivo/security");
    const teacherToken = await signJWT({
      sub: admin.id,
      tenantId,
      role: "TEACHER",
      email: admin.email,
      name: admin.name,
      schoolId,
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/school/teachers",
      headers: { Authorization: `Bearer ${teacherToken}` },
      payload: { email: "x@example.com", name: "X" },
    });
    assert.equal(res.statusCode, 403);
  } finally {
    await cleanup(db, tenantId);
    await teardown(app, db);
  }
});

test("school teachers: a second invite for the same email is rejected", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const { tenantId, schoolId, admin } = await seed(db);
  try {
    const token = await schoolAdminToken(admin, schoolId, tenantId);
    const email = `dupe+${crypto.randomBytes(4).toString("hex")}@example.com`;
    const first = await app.inject({
      method: "POST",
      url: "/api/school/teachers",
      headers: { Authorization: `Bearer ${token}` },
      payload: { email, name: "First" },
    });
    assert.equal(first.statusCode, 200);
    const second = await app.inject({
      method: "POST",
      url: "/api/school/teachers",
      headers: { Authorization: `Bearer ${token}` },
      payload: { email, name: "Second" },
    });
    assert.equal(second.statusCode, 409);
  } finally {
    await cleanup(db, tenantId);
    await teardown(app, db);
  }
});
