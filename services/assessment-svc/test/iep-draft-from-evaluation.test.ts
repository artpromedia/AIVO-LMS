/**
 * Integration test for POST /api/iep/drafts when seeded from an eligible
 * evaluation. The draft creation handler is the hand-off point between the
 * eligibility flow and the authoring flow — it must:
 *
 *   1. Reject seeds from evaluations that are missing or not "eligible".
 *   2. Copy the evaluation's `decisionCategories` into the new profile's
 *      `disabilityCategories` so the teacher does not retype them.
 *   3. Persist a back-link via `iepProfiles.fromEvaluationId` so the UI can
 *      surface "seeded from evaluation X" and the audit trail is complete.
 *   4. Pre-populate present-levels narratives (academic + functional) with
 *      the evaluation's rationale, referral concern, observations,
 *      assessment-area summary, and parent input — eliminating the duplicate
 *      data-entry that the eligibility-evaluation tab already captured.
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
  try { await (db as any).$client?.end?.({ timeout: 2 }); } catch { /* ignore */ }
}

interface Fixture {
  tenantId: string;
  parentId: string;
  teacherId: string;
  learnerId: string;
  evalEligibleId: string;
  evalIneligibleId: string;
  teacherLinkId: string;
}

async function seed(db: any): Promise<Fixture> {
  const { tenants, users, learners, learnerTeachers, iepEvaluations }
    = await import("@aivo/db");
  const stamp = Date.now() + Math.floor(Math.random() * 1_000_000);
  const [t] = await db.insert(tenants).values({
    name: `seed-test-${stamp}`, type: "B2B_DISTRICT",
  } as any).returning();
  const mkUser = async (role: string, name: string) => {
    const [u] = await db.insert(users).values({
      tenantId: t.id, name, role,
      email: `${name}-${stamp}@test.local`,
    } as any).returning();
    return u.id as string;
  };
  const parentId = await mkUser("PARENT", "seed-parent");
  const teacherId = await mkUser("TEACHER", "seed-teacher");
  const learnerUser = await mkUser("LEARNER", "seed-learner-user");
  const [learner] = await db.insert(learners).values({
    tenantId: t.id, userId: learnerUser, parentId,
    name: "Seed Test Learner",
    gradeLevel: "3",
  } as any).returning();
  const [link] = await db.insert(learnerTeachers).values({
    tenantId: t.id,
    learnerId: learner.id,
    teacherEmail: `seed-teacher-${stamp}@test.local`,
    teacherUserId: teacherId,
    invitedBy: parentId,
    status: "ACCEPTED",
    acceptedAt: new Date(),
  } as any).returning();
  const [evalEligible] = await db.insert(iepEvaluations).values({
    learnerId: learner.id,
    tenantId: t.id,
    initiatedByUserId: teacherId,
    status: "eligibility_determined",
    referralReason: "Persistent reading-fluency concerns vs grade-level peers.",
    assessmentAreas: [
      { area: "reading", method: "WJ-IV", findings: "Below 10th percentile", score: "78" },
      { area: "writing", method: "Teacher work samples", findings: "Letter reversals" },
    ],
    observations: "Loses focus during 20+ minute independent reading blocks.",
    parentInput: "Avoids homework that involves reading aloud.",
    decisionEligible: "eligible",
    decisionCategories: ["specific_learning_disability"],
    decisionRationale: "Demonstrated need across reading and writing despite Tier-2 supports.",
    decidedAt: new Date(),
    decidedByUserId: teacherId,
    submittedAt: new Date(),
  } as any).returning();
  const [evalIneligible] = await db.insert(iepEvaluations).values({
    learnerId: learner.id,
    tenantId: t.id,
    initiatedByUserId: teacherId,
    status: "eligibility_determined",
    decisionEligible: "not_eligible",
    decisionCategories: [],
    decisionRationale: "Tier-2 supports sufficient at this time.",
    decidedAt: new Date(),
    decidedByUserId: teacherId,
    submittedAt: new Date(),
  } as any).returning();
  return {
    tenantId: t.id, parentId, teacherId,
    learnerId: learner.id,
    evalEligibleId: evalEligible.id,
    evalIneligibleId: evalIneligible.id,
    teacherLinkId: link.id,
  };
}

async function cleanup(db: any, f: Fixture) {
  const { eq, inArray } = await import("drizzle-orm");
  const {
    tenants, users, learners, learnerTeachers,
    iepEvaluations, iepProfiles, iepPresentLevels, iepTeamMembers,
  } = await import("@aivo/db");
  // Delete every draft we may have created off this learner so we can drop the
  // evaluation FK targets cleanly. Delete the present-levels and team-members
  // children first since the migration may not cascade.
  const profiles = await db.select({ id: iepProfiles.id })
    .from(iepProfiles).where(eq(iepProfiles.learnerId, f.learnerId));
  for (const p of profiles) {
    await db.delete(iepPresentLevels).where(eq(iepPresentLevels.iepProfileId, p.id));
    await db.delete(iepTeamMembers).where(eq(iepTeamMembers.iepProfileId, p.id));
  }
  await db.delete(iepProfiles).where(eq(iepProfiles.learnerId, f.learnerId));
  await db.delete(iepEvaluations).where(inArray(iepEvaluations.id, [f.evalEligibleId, f.evalIneligibleId]));
  await db.delete(learnerTeachers).where(eq(learnerTeachers.id, f.teacherLinkId));
  await db.delete(learners).where(eq(learners.id, f.learnerId));
  await db.delete(users).where(eq(users.tenantId, f.tenantId));
  await db.delete(tenants).where(eq(tenants.id, f.tenantId));
}

async function tokenFor(sub: string, role: string, tenantId: string): Promise<string> {
  const { signJWT } = await import("@aivo/security");
  return signJWT({ sub, role, tenantId }, "5m");
}

test("create-draft: seeds disability categories, back-link, and present-levels from an eligible evaluation",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      const token = await tokenFor(f.teacherId, "TEACHER", f.tenantId);
      const res = await app.inject({
        method: "POST",
        url: "/api/iep/drafts",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        payload: { learnerId: f.learnerId, fromEvaluationId: f.evalEligibleId },
      });
      assert.equal(res.statusCode, 201, `unexpected status: ${res.statusCode} ${res.body}`);
      const profile = res.json();
      assert.equal(profile.fromEvaluationId, f.evalEligibleId,
        "profile.fromEvaluationId must back-link to the source evaluation");
      assert.deepEqual(profile.disabilityCategories, ["specific_learning_disability"],
        "decision categories from the evaluation must seed disabilityCategories");
      assert.equal(profile.source, "authored");
      assert.equal(profile.lifecycleState, "draft");

      // Pull the seeded present-levels and check their content.
      const { eq } = await import("drizzle-orm");
      const { iepPresentLevels } = await import("@aivo/db");
      const plops = await db.select().from(iepPresentLevels)
        .where(eq(iepPresentLevels.iepProfileId, profile.id));
      const byArea: Record<string, string> = {};
      for (const p of plops) byArea[p.area] = p.narrative || "";

      assert.ok(byArea.academic, "academic present-levels narrative must be seeded");
      assert.match(byArea.academic, /Pre-filled from eligibility evaluation/);
      assert.match(byArea.academic, /Eligibility rationale: Demonstrated need/);
      assert.match(byArea.academic, /Referral concern: Persistent reading-fluency/);
      assert.match(byArea.academic, /Observations: Loses focus/);
      assert.match(byArea.academic, /Assessment areas reviewed:/);
      assert.match(byArea.academic, /reading: WJ-IV — Below 10th percentile — 78/);
      assert.match(byArea.academic, /writing: Teacher work samples — Letter reversals/);

      assert.ok(byArea.functional, "functional present-levels narrative must carry parent input");
      assert.match(byArea.functional, /Parent input: Avoids homework/);
    } finally {
      await cleanup(db, f);
      await teardown(app, db);
    }
  });

test("create-draft: rejects seeding from a not-eligible evaluation",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      const token = await tokenFor(f.teacherId, "TEACHER", f.tenantId);
      const res = await app.inject({
        method: "POST",
        url: "/api/iep/drafts",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        payload: { learnerId: f.learnerId, fromEvaluationId: f.evalIneligibleId },
      });
      assert.equal(res.statusCode, 400,
        `non-eligible evaluations must not seed an authoring draft (got ${res.statusCode} ${res.body})`);
      assert.match(res.json().error, /eligible determination/);
    } finally {
      await cleanup(db, f);
      await teardown(app, db);
    }
  });

test("create-draft: works without an evaluation (manual draft path is unchanged)",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      const token = await tokenFor(f.teacherId, "TEACHER", f.tenantId);
      const res = await app.inject({
        method: "POST",
        url: "/api/iep/drafts",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        payload: { learnerId: f.learnerId },
      });
      assert.equal(res.statusCode, 201);
      const profile = res.json();
      assert.equal(profile.fromEvaluationId, null);
      assert.deepEqual(profile.disabilityCategories, []);
      // No present-levels should be auto-seeded on a manual draft.
      const { eq } = await import("drizzle-orm");
      const { iepPresentLevels } = await import("@aivo/db");
      const plops = await db.select().from(iepPresentLevels)
        .where(eq(iepPresentLevels.iepProfileId, profile.id));
      assert.equal(plops.length, 0,
        "manual drafts must not auto-create present-levels rows");
    } finally {
      await cleanup(db, f);
      await teardown(app, db);
    }
  });
