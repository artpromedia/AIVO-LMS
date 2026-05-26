/**
 * Sprint 6 (invite-flows) — full-chain integration test.
 *
 * Exercises the inter-flow chain end-to-end in family-svc:
 *
 *   teacher (created by school admin) invites parent
 *     → parent accepts
 *     → learner_teachers ACCEPTED row created with classroom affinity
 *     → parent invites caregiver and therapist for the same child
 *     → /api/teacher/roster returns the learner once with source=both
 *     → /api/family/collaboration/:learnerId/members returns the
 *       teacher / caregiver / therapist all wired up
 *
 * The identity-svc side of the chain (district admin → school admin →
 * teacher account) is covered by the existing district route-coverage
 * tests + Sprint 1 unit tests; bringing both services up in a single
 * test would require dual-service bootstrapping that's out of scope
 * here. The shared schema and JWT signing key make this in-process
 * test a tight proxy for what the real chain looks like.
 *
 * Skipped without DATABASE_URL.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { createDb } = await import("@aivo/db");
  const { initKeys } = await import("@aivo/security");
  const { registerCollaborationRoutes, resetInviteRateLimitsForTest } = await import(
    "../src/routes/collaboration.js"
  );
  await initKeys();
  resetInviteRateLimitsForTest();
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

async function tokenFor(claims: Record<string, unknown>) {
  const { signJWT } = await import("@aivo/security");
  return signJWT(claims, "10m");
}

test(
  "full chain: school staff onboarding → teacher invite → parent accept → roster",
  { skip: SKIP },
  async () => {
    const { app, db } = await bootstrap();
    const {
      tenants,
      users,
      learners,
      schools,
      classrooms,
      classroomEnrollments,
      learnerTeachers,
      learnerCaregivers,
      learnerTherapists,
    } = await import("@aivo/db");
    const { eq } = await import("drizzle-orm");
    const stamp = Date.now();

    // Stand up a B2B district tenant with a school, a teacher created by
    // the district admin (mirrors what POST /api/district/staff does in
    // identity-svc), a classroom with the teacher assigned, and a parent
    // who already controls a learner enrolled in that classroom.
    const [tenant] = await db
      .insert(tenants)
      .values({ name: `fc-${stamp}`, type: "B2B_DISTRICT" } as any)
      .returning();

    const mk = async (role: string, name: string) => {
      const [u] = await db
        .insert(users)
        .values({
          tenantId: tenant.id,
          name,
          role,
          email: `${name}-${stamp}@test.local`,
        } as any)
        .returning();
      return u as { id: string; email: string; name: string };
    };
    const districtAdmin = await mk("DISTRICT_ADMIN", "fc-da");
    void districtAdmin;
    const schoolAdmin = await mk("SCHOOL_ADMIN", "fc-sa");
    void schoolAdmin;
    const teacher = await mk("TEACHER", "fc-teacher");
    const parent = await mk("PARENT", "fc-parent");
    const learnerUser = await mk("LEARNER", "fc-luser");

    const [school] = await db
      .insert(schools)
      .values({ tenantId: tenant.id, name: `fc-school-${stamp}` } as any)
      .returning();

    const [learner] = await db
      .insert(learners)
      .values({
        tenantId: tenant.id,
        userId: learnerUser.id,
        parentId: parent.id,
        name: "Avery Pine",
        schoolId: school.id,
      } as any)
      .returning();

    const [classroom] = await db
      .insert(classrooms)
      .values({
        schoolId: school.id,
        name: `fc-classroom-${stamp}`,
        teacherId: teacher.id,
      } as any)
      .returning();

    await db
      .insert(classroomEnrollments)
      .values({ classroomId: classroom.id, learnerId: learner.id } as any);

    try {
      const teacherToken = await tokenFor({
        sub: teacher.id,
        role: "TEACHER",
        tenantId: tenant.id,
        email: teacher.email,
      });
      const parentToken = await tokenFor({
        sub: parent.id,
        role: "PARENT",
        tenantId: tenant.id,
        email: parent.email,
      });

      // STEP 1. Teacher invites parent.
      const invRes = await app.inject({
        method: "POST",
        url: "/api/family/collaboration/invite-parent",
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: { learnerId: learner.id, parentEmail: parent.email },
      });
      assert.equal(invRes.statusCode, 201, invRes.body);
      const inviteBody = invRes.json() as any;
      assert.equal(inviteBody.invite.classroomId, classroom.id);

      // STEP 2. Parent accepts.
      const accRes = await app.inject({
        method: "POST",
        url: "/api/family/collaboration/accept-invite",
        headers: { authorization: `Bearer ${parentToken}` },
      });
      assert.equal(accRes.statusCode, 200);
      const accBody = accRes.json() as any;
      assert.ok(
        accBody.accepted.some((a: any) => a.role === "teacher_parent"),
        "expected teacher_parent in accepted list",
      );

      // STEP 3. learner_teachers row exists with classroom affinity.
      const ltRows = await db
        .select()
        .from(learnerTeachers)
        .where(eq(learnerTeachers.learnerId, learner.id));
      assert.equal(ltRows.length, 1);
      assert.equal(ltRows[0].status, "ACCEPTED");
      assert.equal(ltRows[0].classroomId, classroom.id);

      // STEP 4. Parent invites caregiver + therapist for the same child.
      const cgRes = await app.inject({
        method: "POST",
        url: `/api/family/collaboration/${learner.id}/invite/caregiver`,
        headers: { authorization: `Bearer ${parentToken}` },
        payload: { email: `fc-cg-${stamp}@test.local`, relationship: "Grandparent" },
      });
      assert.equal(cgRes.statusCode, 201, cgRes.body);
      const thRes = await app.inject({
        method: "POST",
        url: `/api/family/collaboration/${learner.id}/invite/therapist`,
        headers: { authorization: `Bearer ${parentToken}` },
        payload: { email: `fc-th-${stamp}@test.local`, specialty: "OT" },
      });
      assert.equal(thRes.statusCode, 201, thRes.body);

      // STEP 5. /members returns all three relationships (the teacher
      // arrives via the teacher_parent path, caregiver + therapist via
      // the parent-initiated path).
      const membersRes = await app.inject({
        method: "GET",
        url: `/api/family/collaboration/${learner.id}/members`,
        headers: { authorization: `Bearer ${parentToken}` },
      });
      assert.equal(membersRes.statusCode, 200);
      const members = membersRes.json() as any;
      assert.equal(members.teachers.length, 1);
      assert.equal(members.caregivers.length, 1);
      assert.equal(members.therapists.length, 1);

      // STEP 6. Teacher roster dedupes the two paths to one entry.
      const rosterRes = await app.inject({
        method: "GET",
        url: "/api/teacher/roster",
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      assert.equal(rosterRes.statusCode, 200);
      const roster = rosterRes.json() as any[];
      assert.equal(roster.length, 1);
      assert.equal(roster[0].learnerId, learner.id);
      assert.equal(roster[0].source, "both");
      assert.equal(roster[0].classroomId, classroom.id);
      assert.equal(roster[0].parentName, parent.name);
    } finally {
      // Cleanup.
      const { teacherParentInvites } = await import("@aivo/db");
      await db
        .delete(teacherParentInvites)
        .where(eq(teacherParentInvites.tenantId, tenant.id));
      await db.delete(learnerTeachers).where(eq(learnerTeachers.tenantId, tenant.id));
      await db.delete(learnerCaregivers).where(eq(learnerCaregivers.tenantId, tenant.id));
      await db.delete(learnerTherapists).where(eq(learnerTherapists.tenantId, tenant.id));
      await db
        .delete(classroomEnrollments)
        .where(eq(classroomEnrollments.classroomId, classroom.id));
      await db.delete(classrooms).where(eq(classrooms.id, classroom.id));
      await db.delete(learners).where(eq(learners.id, learner.id));
      await db.delete(schools).where(eq(schools.id, school.id));
      await db.delete(users).where(eq(users.tenantId, tenant.id));
      await db.delete(tenants).where(eq(tenants.id, tenant.id));
      await teardown(app, db);
    }
  },
);
