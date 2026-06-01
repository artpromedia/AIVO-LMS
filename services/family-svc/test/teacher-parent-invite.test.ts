/**
 * Sprint 3 & 4 (invite-flows) — teacher→parent invite + unified roster.
 *
 * Boots family-svc against a real Postgres so the new flow is exercised
 * end-to-end:
 *   1. Teacher with a classroom enrolling a learner POSTs invite-parent.
 *   2. The parent (who owns the learner) accepts via accept-invite.
 *   3. A learner_teachers ACCEPTED row appears with classroom_id set
 *      (Sprint 4 affinity).
 *   4. /api/teacher/roster returns the learner once with source="both".
 *
 * Skips when DATABASE_URL is not set — matches the existing
 * inbox-merge.test.ts skip pattern so this stays cleanly opt-in for CI
 * envs that don't run the full DB.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { createDb } = await import("@aivo/db");
  const { initKeys } = await import("@aivo/security");
  const { registerCollaborationRoutes } = await import("../src/routes/collaboration.js");
  await initKeys();
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify({ logger: false });
  (app as any).db = db;
  await registerCollaborationRoutes(app);
  await app.ready();
  return { app, db };
}

async function teardown(app: any, db: any) {
  await app.close();
  try {
    await (db as any).$client?.end?.({ timeout: 2 });
  } catch {
    /* ignore */
  }
}

interface Fixture {
  tenantId: string;
  parentId: string;
  teacherId: string;
  learnerId: string;
  classroomId: string;
  schoolId: string;
  parentEmail: string;
}

async function seed(db: any): Promise<Fixture> {
  const {
    tenants,
    users,
    learners,
    schools,
    classrooms,
    classroomEnrollments,
  } = await import("@aivo/db");
  const stamp = Date.now();

  const [t] = await db
    .insert(tenants)
    .values({ name: `tp-invite-${stamp}`, type: "B2B_DISTRICT" } as any)
    .returning();

  const mkUser = async (role: string, name: string) => {
    const [u] = await db
      .insert(users)
      .values({
        tenantId: t.id,
        name,
        role,
        email: `${name}-${stamp}@test.local`,
      } as any)
      .returning();
    return u as { id: string; email: string };
  };

  const parent = await mkUser("PARENT", "tp-parent");
  const teacher = await mkUser("TEACHER", "tp-teacher");
  const learnerUser = await mkUser("LEARNER", "tp-luser");

  const [school] = await db
    .insert(schools)
    .values({ tenantId: t.id, name: `tp-school-${stamp}` } as any)
    .returning();

  const [learner] = await db
    .insert(learners)
    .values({
      tenantId: t.id,
      userId: learnerUser.id,
      parentId: parent.id,
      name: "Jamie Quill",
      schoolId: school.id,
    } as any)
    .returning();

  const [classroom] = await db
    .insert(classrooms)
    .values({
      schoolId: school.id,
      name: `tp-classroom-${stamp}`,
      teacherId: teacher.id,
    } as any)
    .returning();

  await db
    .insert(classroomEnrollments)
    .values({ classroomId: classroom.id, learnerId: learner.id } as any);

  return {
    tenantId: t.id,
    parentId: parent.id,
    teacherId: teacher.id,
    learnerId: learner.id,
    classroomId: classroom.id,
    schoolId: school.id,
    parentEmail: parent.email,
  };
}

async function cleanup(db: any, f: Fixture) {
  const { eq, inArray } = await import("drizzle-orm");
  const {
    tenants,
    users,
    learners,
    schools,
    classrooms,
    classroomEnrollments,
    learnerTeachers,
    teacherParentInvites,
  } = await import("@aivo/db");
  await db
    .delete(teacherParentInvites)
    .where(eq(teacherParentInvites.tenantId, f.tenantId));
  await db.delete(learnerTeachers).where(eq(learnerTeachers.tenantId, f.tenantId));
  await db
    .delete(classroomEnrollments)
    .where(eq(classroomEnrollments.classroomId, f.classroomId));
  await db.delete(classrooms).where(eq(classrooms.id, f.classroomId));
  await db.delete(learners).where(eq(learners.id, f.learnerId));
  await db.delete(schools).where(eq(schools.id, f.schoolId));
  await db.delete(users).where(eq(users.tenantId, f.tenantId));
  await db.delete(tenants).where(eq(tenants.id, f.tenantId));
}

async function tokenFor(claims: Record<string, unknown>) {
  const { signJWT } = await import("@aivo/security");
  return signJWT(claims, "5m");
}

test(
  "teacher → parent invite: full happy path with classroom affinity + unified roster",
  { skip: SKIP },
  async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      const teacherToken = await tokenFor({
        sub: f.teacherId,
        role: "TEACHER",
        tenantId: f.tenantId,
        email: `tp-teacher-x@test.local`,
        name: "tp-teacher",
      });

      // 1. Teacher creates the invite.
      const inviteRes = await app.inject({
        method: "POST",
        url: "/api/family/collaboration/invite-parent",
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: { learnerId: f.learnerId, parentEmail: f.parentEmail },
      });
      assert.equal(inviteRes.statusCode, 201, inviteRes.body);
      const inviteBody = inviteRes.json() as any;
      assert.equal(inviteBody.invite.parentEmail, f.parentEmail);
      // Sprint 4: classroom_id should be auto-set because the teacher
      // runs a classroom containing this learner.
      assert.equal(inviteBody.invite.classroomId, f.classroomId);

      // 2. Duplicate invite is rejected (409).
      const dupeRes = await app.inject({
        method: "POST",
        url: "/api/family/collaboration/invite-parent",
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: { learnerId: f.learnerId, parentEmail: f.parentEmail },
      });
      assert.equal(dupeRes.statusCode, 409);

      // 3. Parent accepts.
      const parentToken = await tokenFor({
        sub: f.parentId,
        role: "PARENT",
        tenantId: f.tenantId,
        email: f.parentEmail,
      });
      const acceptRes = await app.inject({
        method: "POST",
        url: "/api/family/collaboration/accept-invite",
        headers: { authorization: `Bearer ${parentToken}` },
      });
      assert.equal(acceptRes.statusCode, 200);
      const acceptBody = acceptRes.json() as any;
      const teacherParentAccepted = acceptBody.accepted.filter(
        (a: any) => a.role === "teacher_parent",
      );
      assert.equal(teacherParentAccepted.length, 1);
      assert.equal(teacherParentAccepted[0].learnerId, f.learnerId);

      // 4. learner_teachers row was created with classroom affinity.
      const { learnerTeachers } = await import("@aivo/db");
      const { eq } = await import("drizzle-orm");
      const links = await db
        .select()
        .from(learnerTeachers)
        .where(eq(learnerTeachers.learnerId, f.learnerId));
      assert.equal(links.length, 1);
      assert.equal(links[0].status, "ACCEPTED");
      assert.equal(links[0].teacherUserId, f.teacherId);
      assert.equal(links[0].classroomId, f.classroomId);

      // 5. Unified roster returns the learner once with source=both.
      const rosterRes = await app.inject({
        method: "GET",
        url: "/api/teacher/roster",
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      assert.equal(rosterRes.statusCode, 200);
      const roster = rosterRes.json() as any[];
      assert.equal(roster.length, 1);
      assert.equal(roster[0].learnerId, f.learnerId);
      assert.equal(roster[0].source, "both");
      assert.equal(roster[0].classroomId, f.classroomId);
    } finally {
      await cleanup(db, f);
      await teardown(app, db);
    }
  },
);

test(
  "teacher → parent invite: rejects teacher who doesn't run the learner's classroom",
  { skip: SKIP },
  async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      const { users } = await import("@aivo/db");
      const stamp = Date.now();
      const [otherTeacher] = await db
        .insert(users)
        .values({
          tenantId: f.tenantId,
          name: "tp-other-teacher",
          role: "TEACHER",
          email: `tp-other-${stamp}@test.local`,
        } as any)
        .returning();

      const otherToken = await tokenFor({
        sub: otherTeacher.id,
        role: "TEACHER",
        tenantId: f.tenantId,
        email: otherTeacher.email,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/family/collaboration/invite-parent",
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { learnerId: f.learnerId, parentEmail: f.parentEmail },
      });
      assert.equal(res.statusCode, 403);
    } finally {
      await cleanup(db, f);
      await teardown(app, db);
    }
  },
);

test(
  "teacher → parent invite: accept-invite from wrong-email user leaves invite PENDING",
  { skip: SKIP },
  async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      const teacherToken = await tokenFor({
        sub: f.teacherId,
        role: "TEACHER",
        tenantId: f.tenantId,
        email: `t@test.local`,
      });
      await app.inject({
        method: "POST",
        url: "/api/family/collaboration/invite-parent",
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: { learnerId: f.learnerId, parentEmail: f.parentEmail },
      });

      // Signed in as someone OTHER than the listed parent — the wrong
      // email simply yields zero accepted rows, the invite stays PENDING.
      const intruderToken = await tokenFor({
        sub: "11111111-1111-1111-1111-111111111111",
        role: "PARENT",
        tenantId: f.tenantId,
        email: "intruder@test.local",
      });
      const res = await app.inject({
        method: "POST",
        url: "/api/family/collaboration/accept-invite",
        headers: { authorization: `Bearer ${intruderToken}` },
      });
      assert.equal(res.statusCode, 200);
      const body = res.json() as any;
      assert.equal(
        body.accepted.filter((a: any) => a.role === "teacher_parent").length,
        0,
      );

      const { teacherParentInvites } = await import("@aivo/db");
      const rows = await db.select().from(teacherParentInvites);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].status, "PENDING");
    } finally {
      await cleanup(db, f);
      await teardown(app, db);
    }
  },
);

test(
  "invite-parent: admin from a different tenant is rejected (cross-tenant scope)",
  { skip: SKIP },
  async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      // A DISTRICT_ADMIN whose tenant does NOT match the learner's tenant must
      // not be able to invite a parent for that learner, even though their role
      // is privileged. Scope is enforced at the route, not taken on faith.
      const foreignAdminToken = await tokenFor({
        sub: "22222222-2222-2222-2222-222222222222",
        role: "DISTRICT_ADMIN",
        tenantId: "33333333-3333-3333-3333-333333333333",
        email: "foreign-admin@test.local",
      });
      const res = await app.inject({
        method: "POST",
        url: "/api/family/collaboration/invite-parent",
        headers: { authorization: `Bearer ${foreignAdminToken}` },
        payload: {
          learnerId: f.learnerId,
          parentEmail: f.parentEmail,
          teacherUserId: f.teacherId,
        },
      });
      assert.equal(res.statusCode, 403, res.body);

      // No invite row should have been written.
      const { teacherParentInvites } = await import("@aivo/db");
      const { eq } = await import("drizzle-orm");
      const rows = await db
        .select()
        .from(teacherParentInvites)
        .where(eq(teacherParentInvites.learnerId, f.learnerId));
      assert.equal(rows.length, 0);

      // An in-tenant admin on the same learner is allowed (201).
      const inTenantAdminToken = await tokenFor({
        sub: "44444444-4444-4444-4444-444444444444",
        role: "DISTRICT_ADMIN",
        tenantId: f.tenantId,
        email: "in-tenant-admin@test.local",
      });
      const okRes = await app.inject({
        method: "POST",
        url: "/api/family/collaboration/invite-parent",
        headers: { authorization: `Bearer ${inTenantAdminToken}` },
        payload: {
          learnerId: f.learnerId,
          parentEmail: f.parentEmail,
          teacherUserId: f.teacherId,
        },
      });
      assert.equal(okRes.statusCode, 201, okRes.body);
    } finally {
      await cleanup(db, f);
      await teardown(app, db);
    }
  },
);
