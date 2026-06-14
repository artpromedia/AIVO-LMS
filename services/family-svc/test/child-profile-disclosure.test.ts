/**
 * Sprint C-12 (ADR 0042) — FERPA cross-role disclosure log + query surface.
 *
 * The services-side disclosure store is the hash-chained, append-only
 * `audit_events` table. When a teacher (not the parent) reads a child's brain
 * profile via the family-svc teacher view, a `CHILD_PROFILE_DISCLOSED` event is
 * recorded with the disclosure tuple (tenantId, learnerId, readerUserId,
 * readerRole, surface, dataClass, timestamp). The compliance query endpoint
 * returns that learner's disclosures, time-bounded, to admin/compliance roles
 * only.
 *
 * Proves:
 *   • a teacher read produces exactly one disclosure row with the right tuple;
 *   • the compliance endpoint returns it for an admin (authz: only admins);
 *   • a teacher/parent CANNOT query the disclosure log (403);
 *   • a parent reading their OWN child produces NO disclosure (not cross-role).
 *
 * Auto-migrates Postgres via provisionTestDatabase. Skipped without
 * DATABASE_URL (the standard family-svc convention — every DB-backed test here
 * skips without a live Postgres; CI provides one). Pool closed in finally.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { provisionTestDatabase } = await import("@aivo/db");
  const { initKeys } = await import("@aivo/security");
  const { registerCollaborationRoutes } = await import("../src/routes/collaboration.js");
  const { registerComplianceRoutes } = await import("../src/routes/compliance.js");
  await initKeys();
  const { db, teardown } = await provisionTestDatabase();
  const app = Fastify({ logger: false });
  (app as any).db = db;
  await registerCollaborationRoutes(app);
  await registerComplianceRoutes(app);
  await app.ready();
  return { app, db, teardown };
}

async function tokenFor(claims: Record<string, unknown>) {
  const { signJWT } = await import("@aivo/security");
  return signJWT(claims, "10m");
}

test(
  "disclosure: teacher read logs CHILD_PROFILE_DISCLOSED; compliance endpoint returns it; authz enforced",
  { skip: SKIP },
  async () => {
    const { app, db, teardown } = await bootstrap();
    const { tenants, users, learners, learnerTeachers, brainStates, auditEvents } =
      await import("@aivo/db");
    const { eq, and } = await import("drizzle-orm");
    const stamp = Date.now();

    const [tenant] = await db
      .insert(tenants)
      .values({ name: `disc-${stamp}`, type: "B2C_FAMILY" } as any)
      .returning();
    const mkUser = async (role: string, name: string) => {
      const [u] = await db
        .insert(users)
        .values({ tenantId: tenant.id, name, role, email: `${name}-${stamp}@test.local` } as any)
        .returning();
      return u as { id: string; email: string };
    };
    const parent = await mkUser("PARENT", "disc-parent");
    const teacher = await mkUser("TEACHER", "disc-teacher");
    const learnerUser = await mkUser("LEARNER", "disc-learner");
    const admin = await mkUser("PLATFORM_ADMIN", "disc-admin");

    const [learner] = await db
      .insert(learners)
      .values({
        tenantId: tenant.id,
        userId: learnerUser.id,
        parentId: parent.id,
        name: "Disclosure Subject",
      } as any)
      .returning();

    // Link the teacher (ACCEPTED) and seed a brain state to read.
    // learner_teachers requires NOT NULL tenant_id + invited_by (the parent
    // invited the teacher) — provide both so the seed inserts cleanly.
    await db
      .insert(learnerTeachers)
      .values({
        tenantId: tenant.id,
        learnerId: learner.id,
        teacherEmail: teacher.email,
        teacherUserId: teacher.id,
        invitedBy: parent.id,
        status: "ACCEPTED",
      } as any);
    await db
      .insert(brainStates)
      .values({
        tenantId: tenant.id,
        learnerId: learner.id,
        masteryLevels: { math: 50 },
        activeAccommodations: ["read_aloud"],
        activeTutors: ["nova"],
        approvalStatus: "approved",
        version: 2,
      } as any);

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
      const adminToken = await tokenFor({
        sub: admin.id,
        role: "PLATFORM_ADMIN",
        tenantId: tenant.id,
        email: admin.email,
      });

      // 1. Teacher reads the brain (cross-role) → 200 + one disclosure row.
      const readRes = await app.inject({
        method: "GET",
        url: `/api/family/collaboration/${learner.id}/brain/teacher`,
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      assert.equal(readRes.statusCode, 200, readRes.body);

      const rows = await db
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.eventType, "CHILD_PROFILE_DISCLOSED"),
            eq(auditEvents.resourceId, learner.id),
          ),
        );
      assert.equal(rows.length, 1, "expected exactly one CHILD_PROFILE_DISCLOSED row");
      const details = rows[0].details as Record<string, unknown>;
      assert.equal(details.readerUserId, teacher.id);
      assert.equal(details.readerRole, "TEACHER");
      assert.equal(details.dataClass, "brain_state_teacher_scoped");
      assert.ok(String(details.surface).includes("brain/teacher"));
      assert.equal(rows[0].userId, teacher.id);
      assert.equal(rows[0].tenantId, tenant.id);

      // 2. Compliance endpoint returns the disclosure for an admin.
      const queryRes = await app.inject({
        method: "GET",
        url: `/api/family/compliance/disclosures/${learner.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      assert.equal(queryRes.statusCode, 200, queryRes.body);
      const body = queryRes.json() as {
        count: number;
        disclosures: Array<{
          readerUserId: string;
          readerRole: string;
          surface: string;
          dataClass: string;
          disclosedAt: string;
        }>;
      };
      assert.equal(body.count, 1);
      assert.equal(body.disclosures[0].readerUserId, teacher.id);
      assert.equal(body.disclosures[0].readerRole, "TEACHER");
      assert.equal(body.disclosures[0].dataClass, "brain_state_teacher_scoped");
      assert.ok(body.disclosures[0].disclosedAt);

      // 3. Time window that excludes the row returns nothing.
      const past = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const pastEnd = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString();
      const emptyRes = await app.inject({
        method: "GET",
        url: `/api/family/compliance/disclosures/${learner.id}?from=${past}&to=${pastEnd}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      assert.equal(emptyRes.statusCode, 200);
      assert.equal((emptyRes.json() as { count: number }).count, 0);

      // 4. AUTHZ: a teacher cannot query the disclosure log (403).
      const teacherQuery = await app.inject({
        method: "GET",
        url: `/api/family/compliance/disclosures/${learner.id}`,
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      assert.equal(teacherQuery.statusCode, 403, teacherQuery.body);

      // ...and neither can the parent (compliance/admin only).
      const parentQuery = await app.inject({
        method: "GET",
        url: `/api/family/compliance/disclosures/${learner.id}`,
        headers: { authorization: `Bearer ${parentToken}` },
      });
      assert.equal(parentQuery.statusCode, 403, parentQuery.body);

      // 5. A PARENT reading their OWN child is NOT a cross-role read — no new row.
      const parentRead = await app.inject({
        method: "GET",
        url: `/api/family/collaboration/${learner.id}/brain/teacher`,
        headers: { authorization: `Bearer ${parentToken}` },
      });
      assert.equal(parentRead.statusCode, 200, parentRead.body);
      const afterParentRead = await db
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.eventType, "CHILD_PROFILE_DISCLOSED"),
            eq(auditEvents.resourceId, learner.id),
          ),
        );
      assert.equal(afterParentRead.length, 1, "parent self-read must not add a disclosure row");
    } finally {
      await teardown();
    }
  },
);
