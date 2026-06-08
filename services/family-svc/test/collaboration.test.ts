/**
 * Sprint 2 (parent-assessment → collaborator invites → brain build):
 * route-level regression for the pre-build collaborator step in family-svc.
 *
 * Reuses the existing per-role invite tables (learner_teachers /
 * learner_caregivers / learner_therapists) and the brain_insights surface
 * — see packages/db/drizzle/0071_brain_insights_tenant_scope.sql for why we
 * reuse rather than add parallel collaborator_* tables.
 *
 * Covers (per the Sprint 2 DoD):
 *   • an invite persists and is returned on GET /members
 *   • seat-cap rejection (a second teacher is refused)
 *   • an insight persists, tenant-scoped + role-attributed
 *   • accept-invite links a previously-pending invite to the user
 *   • tenant isolation: a parent from another tenant cannot read the
 *     learner's team (route-layer ownership enforcement — family-svc does
 *     not set the web-domain RLS GUC, so isolation lives in the guards)
 *
 * Auto-migrates Postgres via provisionTestDatabase (no db:push). Skipped
 * without DATABASE_URL. Closes the pool in finally so the runner exits.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { provisionTestDatabase } = await import("@aivo/db");
  const { initKeys } = await import("@aivo/security");
  const { registerCollaborationRoutes, resetInviteRateLimitsForTest } = await import(
    "../src/routes/collaboration.js"
  );
  await initKeys();
  resetInviteRateLimitsForTest();
  const { db, teardown } = await provisionTestDatabase();
  const app = Fastify({ logger: false });
  (app as any).db = db;
  await registerCollaborationRoutes(app);
  await app.ready();
  return { app, db, teardown };
}

async function tokenFor(claims: Record<string, unknown>) {
  const { signJWT } = await import("@aivo/security");
  return signJWT(claims, "10m");
}

test(
  "collaboration: invite persists, seat caps, insight, accept-link, tenant isolation",
  { skip: SKIP },
  async () => {
    const { app, db, teardown } = await bootstrap();
    const { tenants, users, learners, learnerTeachers, learnerCaregivers, learnerTherapists, brainInsights } =
      await import("@aivo/db");
    const { eq } = await import("drizzle-orm");
    const stamp = Date.now();

    const mkTenant = async (suffix: string) => {
      const [t] = await db
        .insert(tenants)
        .values({ name: `collab-${suffix}-${stamp}`, type: "B2C_FAMILY" } as any)
        .returning();
      return t as { id: string };
    };
    const mkUser = async (tenantId: string, role: string, name: string) => {
      const [u] = await db
        .insert(users)
        .values({ tenantId, name, role, email: `${name}-${stamp}@test.local` } as any)
        .returning();
      return u as { id: string; email: string; name: string };
    };

    const tenantA = await mkTenant("a");
    const tenantB = await mkTenant("b");
    const parentA = await mkUser(tenantA.id, "PARENT", "collab-pa");
    const parentB = await mkUser(tenantB.id, "PARENT", "collab-pb");
    const learnerUser = await mkUser(tenantA.id, "LEARNER", "collab-lu");

    const [learner] = await db
      .insert(learners)
      .values({
        tenantId: tenantA.id,
        userId: learnerUser.id,
        parentId: parentA.id,
        name: "Robin Cedar",
      } as any)
      .returning();

    try {
      const parentAToken = await tokenFor({
        sub: parentA.id,
        role: "PARENT",
        tenantId: tenantA.id,
        email: parentA.email,
      });
      const parentBToken = await tokenFor({
        sub: parentB.id,
        role: "PARENT",
        tenantId: tenantB.id,
        email: parentB.email,
      });

      // 1. Invite a teacher (no pre-existing user ⇒ PENDING) and confirm it
      //    is returned by GET /members.
      const teacherEmail = `collab-teacher-${stamp}@test.local`;
      const inviteRes = await app.inject({
        method: "POST",
        url: `/api/family/collaboration/${learner.id}/invite/teacher`,
        headers: { authorization: `Bearer ${parentAToken}` },
        payload: { email: teacherEmail },
      });
      assert.equal(inviteRes.statusCode, 201, inviteRes.body);
      const invited = inviteRes.json() as any;
      assert.equal(invited.status, "PENDING");
      assert.equal(invited.teacherEmail, teacherEmail);

      const membersRes = await app.inject({
        method: "GET",
        url: `/api/family/collaboration/${learner.id}/members`,
        headers: { authorization: `Bearer ${parentAToken}` },
      });
      assert.equal(membersRes.statusCode, 200);
      const members = membersRes.json() as any;
      assert.equal(members.teachers.length, 1);
      assert.equal(members.teachers[0].teacherEmail, teacherEmail);
      assert.equal(members.seats.teacher.used, 1);
      assert.equal(members.seats.teacher.max, 1);

      // 2. Seat cap: a second teacher is refused (B2C plan = 1 teacher).
      const secondTeacherRes = await app.inject({
        method: "POST",
        url: `/api/family/collaboration/${learner.id}/invite/teacher`,
        headers: { authorization: `Bearer ${parentAToken}` },
        payload: { email: `collab-teacher2-${stamp}@test.local` },
      });
      assert.equal(secondTeacherRes.statusCode, 400, secondTeacherRes.body);

      // 3. An insight persists, tenant-scoped + role-attributed.
      const insightRes = await app.inject({
        method: "POST",
        url: `/api/family/collaboration/${learner.id}/insight`,
        headers: { authorization: `Bearer ${parentAToken}` },
        payload: { insightText: "Robin focuses best mid-morning.", domain: "attention" },
      });
      assert.equal(insightRes.statusCode, 201, insightRes.body);
      const insightRows = await db
        .select()
        .from(brainInsights)
        .where(eq(brainInsights.learnerId, learner.id));
      assert.equal(insightRows.length, 1);
      assert.equal(insightRows[0].tenantId, tenantA.id, "insight is stamped with the tenant");
      assert.equal(insightRows[0].authorRole, "parent");
      assert.equal(insightRows[0].domain, "attention");

      // 4. Accept-invite links the pending teacher invite to a real user.
      const teacherUser = await mkUser(tenantA.id, "TEACHER", "collab-teacher-real");
      // The invited email and the accepting user's email must match; rewrite
      // the user's email to the invited address.
      await db.update(users).set({ email: teacherEmail }).where(eq(users.id, teacherUser.id));
      const teacherToken = await tokenFor({
        sub: teacherUser.id,
        role: "TEACHER",
        tenantId: tenantA.id,
        email: teacherEmail,
      });
      const acceptRes = await app.inject({
        method: "POST",
        url: "/api/family/collaboration/accept-invite",
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      assert.equal(acceptRes.statusCode, 200, acceptRes.body);
      const accepted = acceptRes.json() as any;
      assert.ok(accepted.accepted.some((a: any) => a.role === "teacher" && a.learnerId === learner.id));
      const linked = await db
        .select()
        .from(learnerTeachers)
        .where(eq(learnerTeachers.learnerId, learner.id));
      assert.equal(linked[0].status, "ACCEPTED");
      assert.equal(linked[0].teacherUserId, teacherUser.id);

      // 5. Tenant isolation: parent B (different tenant) cannot read the
      //    team of tenant A's learner.
      const crossTenantRes = await app.inject({
        method: "GET",
        url: `/api/family/collaboration/${learner.id}/members`,
        headers: { authorization: `Bearer ${parentBToken}` },
      });
      assert.equal(crossTenantRes.statusCode, 403, "cross-tenant read must be denied");
    } finally {
      try {
        await db.delete(brainInsights).where(eq(brainInsights.learnerId, learner.id));
        await db.delete(learnerTherapists).where(eq(learnerTherapists.tenantId, tenantA.id));
        await db.delete(learnerCaregivers).where(eq(learnerCaregivers.tenantId, tenantA.id));
        await db.delete(learnerTeachers).where(eq(learnerTeachers.tenantId, tenantA.id));
        await db.delete(learners).where(eq(learners.id, learner.id));
        await db.delete(users).where(eq(users.tenantId, tenantA.id));
        await db.delete(users).where(eq(users.tenantId, tenantB.id));
        await db.delete(tenants).where(eq(tenants.id, tenantA.id));
        await db.delete(tenants).where(eq(tenants.id, tenantB.id));
      } finally {
        await app.close();
        await teardown();
      }
    }
  },
);
