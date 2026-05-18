/**
 * Sprint task #12 — SPED_LEAD school-scoped role + per-learner case
 * manager surfacing on draft cards.
 *
 * Asserts:
 *   1. SPED_LEAD with users.school_id matching the learner's school can
 *      read + write IEP authoring rows.
 *   2. SPED_LEAD whose users.school_id is set to a DIFFERENT school in
 *      the same tenant cannot — the role authority is school-scoped, not
 *      tenant-wide.
 *   3. SPED_LEAD with no school_id at all is denied (misconfiguration is
 *      not silently treated as district-wide access).
 *   4. /api/iep/drafts/learner/:learnerId decorates each draft row with
 *      the bootstrapped case manager pulled from iep_team_members.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { createDb } = await import("@aivo/db");
  const { registerIepAuthoringRoutes } = await import("../src/routes/iep-authoring.js");
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify({ logger: false });
  (app as any).db = db;
  await registerIepAuthoringRoutes(app);
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
  schoolAId: string;
  schoolBId: string;
  parentId: string;
  teacherId: string;
  spedLeadAId: string;
  spedLeadBId: string;
  spedLeadNoSchoolId: string;
  learnerId: string;
  teacherLinkId: string;
}

async function seed(db: any): Promise<Fixture> {
  const { tenants, users, learners, learnerTeachers } = await import("@aivo/db");
  const stamp = Date.now() + Math.floor(Math.random() * 1_000_000);
  const [t] = await db
    .insert(tenants)
    .values({
      name: `sped-${stamp}`,
      type: "B2B_DISTRICT",
    } as any)
    .returning();
  const schoolAId = crypto.randomUUID();
  const schoolBId = crypto.randomUUID();
  const mkUser = async (role: string, name: string, schoolId: string | null = null) => {
    const [u] = await db
      .insert(users)
      .values({
        tenantId: t.id,
        name,
        role,
        schoolId: schoolId || null,
        email: `${name}-${stamp}@test.local`,
      } as any)
      .returning();
    return u.id as string;
  };
  const parentId = await mkUser("PARENT", "sped-parent");
  const teacherId = await mkUser("TEACHER", "sped-teacher", schoolAId);
  const spedLeadAId = await mkUser("SPED_LEAD", "sped-lead-a", schoolAId);
  const spedLeadBId = await mkUser("SPED_LEAD", "sped-lead-b", schoolBId);
  const spedLeadNoSchoolId = await mkUser("SPED_LEAD", "sped-lead-no-school", null);
  const learnerUserId = await mkUser("LEARNER", "sped-luser");
  const [learner] = await db
    .insert(learners)
    .values({
      tenantId: t.id,
      userId: learnerUserId,
      parentId,
      name: "SPED Learner",
      schoolId: schoolAId,
    } as any)
    .returning();
  const [link] = await db
    .insert(learnerTeachers)
    .values({
      tenantId: t.id,
      learnerId: learner.id,
      teacherEmail: `sped-teacher-${stamp}@test.local`,
      teacherUserId: teacherId,
      invitedBy: parentId,
      status: "ACCEPTED",
      acceptedAt: new Date(),
    } as any)
    .returning();
  return {
    tenantId: t.id,
    schoolAId,
    schoolBId,
    parentId,
    teacherId,
    spedLeadAId,
    spedLeadBId,
    spedLeadNoSchoolId,
    learnerId: learner.id,
    teacherLinkId: link.id,
  };
}

async function cleanup(db: any, f: Fixture) {
  const { eq } = await import("drizzle-orm");
  const {
    tenants,
    users,
    learners,
    learnerTeachers,
    iepProfiles,
    iepTeamMembers,
    iepPresentLevels,
  } = await import("@aivo/db");
  const profiles = await db
    .select({ id: iepProfiles.id })
    .from(iepProfiles)
    .where(eq(iepProfiles.learnerId, f.learnerId));
  for (const p of profiles) {
    await db.delete(iepPresentLevels).where(eq(iepPresentLevels.iepProfileId, p.id));
    await db.delete(iepTeamMembers).where(eq(iepTeamMembers.iepProfileId, p.id));
  }
  await db.delete(iepProfiles).where(eq(iepProfiles.learnerId, f.learnerId));
  await db.delete(learnerTeachers).where(eq(learnerTeachers.id, f.teacherLinkId));
  await db.delete(learners).where(eq(learners.id, f.learnerId));
  await db.delete(users).where(eq(users.tenantId, f.tenantId));
  await db.delete(tenants).where(eq(tenants.id, f.tenantId));
}

async function tokenFor(sub: string, role: string, tenantId: string): Promise<string> {
  const { signJWT } = await import("@aivo/security");
  return signJWT({ sub, role, tenantId }, "5m");
}

test(
  "SPED_LEAD with matching school can create drafts; mismatched / unset school cannot",
  { skip: SKIP },
  async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      // Same-school SPED_LEAD: 201
      const tokA = await tokenFor(f.spedLeadAId, "SPED_LEAD", f.tenantId);
      const okRes = await app.inject({
        method: "POST",
        url: "/api/iep/drafts",
        headers: { Authorization: `Bearer ${tokA}`, "Content-Type": "application/json" },
        payload: { learnerId: f.learnerId },
      });
      assert.equal(okRes.statusCode, 201, okRes.body);

      // Different-school SPED_LEAD: 403
      const tokB = await tokenFor(f.spedLeadBId, "SPED_LEAD", f.tenantId);
      const cross = await app.inject({
        method: "POST",
        url: "/api/iep/drafts",
        headers: { Authorization: `Bearer ${tokB}`, "Content-Type": "application/json" },
        payload: { learnerId: f.learnerId },
      });
      assert.equal(
        cross.statusCode,
        403,
        "SPED_LEAD authority is school-scoped — different-school must be denied",
      );

      // SPED_LEAD with no school assignment: 403
      const tokNone = await tokenFor(f.spedLeadNoSchoolId, "SPED_LEAD", f.tenantId);
      const noSchool = await app.inject({
        method: "POST",
        url: "/api/iep/drafts",
        headers: { Authorization: `Bearer ${tokNone}`, "Content-Type": "application/json" },
        payload: { learnerId: f.learnerId },
      });
      assert.equal(
        noSchool.statusCode,
        403,
        "SPED_LEAD without users.school_id must be denied (misconfiguration ≠ access)",
      );
    } finally {
      await cleanup(db, f);
      await teardown(app, db);
    }
  },
);

test(
  "/api/iep/drafts/learner/:id decorates each draft row with the case manager",
  { skip: SKIP },
  async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      // Create a draft as the teacher; the create-draft handler bootstraps
      // the author as case_manager via iep_team_members.
      const teacherToken = await tokenFor(f.teacherId, "TEACHER", f.tenantId);
      const created = await app.inject({
        method: "POST",
        url: "/api/iep/drafts",
        headers: { Authorization: `Bearer ${teacherToken}`, "Content-Type": "application/json" },
        payload: { learnerId: f.learnerId },
      });
      assert.equal(created.statusCode, 201, created.body);

      const list = await app.inject({
        method: "GET",
        url: `/api/iep/drafts/learner/${f.learnerId}`,
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      assert.equal(list.statusCode, 200, list.body);
      const rows = list.json();
      assert.ok(
        Array.isArray(rows) && rows.length >= 1,
        "drafts list must include the draft we just created",
      );
      const fresh = rows.find((r: any) => r.id === created.json().id);
      assert.ok(fresh, "created draft is in the list");
      assert.ok(fresh.caseManager, "drafts list must decorate each row with caseManager metadata");
      assert.equal(
        fresh.caseManager.userId,
        f.teacherId,
        "the bootstrapped case manager is the original author",
      );
    } finally {
      await cleanup(db, f);
      await teardown(app, db);
    }
  },
);
