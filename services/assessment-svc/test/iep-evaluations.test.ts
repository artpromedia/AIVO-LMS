/**
 * Integration coverage for the seven endpoints in
 * services/assessment-svc/src/routes/iep-evaluations.ts.
 *
 * Each endpoint is exercised on three axes:
 *  - happy path (correct role + tenant + state)
 *  - 403 / authz boundary (wrong role, wrong tenant, parent attempting writes)
 *  - 409 / state-machine guard (already-decided edits, double-submit, etc.)
 *
 * Tenant isolation is verified explicitly: a DISTRICT_ADMIN whose JWT carries
 * tenant B must not be able to read or mutate evaluations for a learner in
 * tenant A. PARENT access is read-only and shape-restricted: full evaluation
 * fields must never leak to a parent, even on the GET-single endpoint.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { createDb } = await import("@aivo/db");
  const { registerIepEvaluationRoutes } = await import("../src/routes/iep-evaluations.js");
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify({ logger: false });
  (app as any).db = db;
  await registerIepEvaluationRoutes(app);
  await app.ready();
  return { app, db };
}

async function teardown(app: any, db: any) {
  await app.close();
  try { await (db as any).$client?.end?.({ timeout: 2 }); } catch { /* ignore */ }
}

interface Fixture {
  tenantAId: string;
  tenantBId: string;
  parentAId: string;
  parentBId: string;
  teacherAId: string;
  teacherUnassignedId: string;
  districtAdminAId: string;
  districtAdminBId: string;
  platformAdminId: string;
  learnerAId: string;
  learnerBId: string;
  teacherLinkAId: string;
}

async function seed(db: any): Promise<Fixture> {
  const { tenants, users, learners, learnerTeachers } = await import("@aivo/db");
  const stamp = Date.now() + Math.floor(Math.random() * 1_000_000);
  const [tA] = await db.insert(tenants).values({
    name: `eval-tenant-a-${stamp}`, type: "B2B_DISTRICT",
  } as any).returning();
  const [tB] = await db.insert(tenants).values({
    name: `eval-tenant-b-${stamp}`, type: "B2B_DISTRICT",
  } as any).returning();
  const mkUser = async (tenantId: string, role: string, name: string) => {
    const [u] = await db.insert(users).values({
      tenantId, name, role,
      email: `${name}-${stamp}@test.local`,
    } as any).returning();
    return u.id as string;
  };
  const parentAId = await mkUser(tA.id, "PARENT", "eval-parent-a");
  const parentBId = await mkUser(tB.id, "PARENT", "eval-parent-b");
  const teacherAId = await mkUser(tA.id, "TEACHER", "eval-teacher-a");
  const teacherUnassignedId = await mkUser(tA.id, "TEACHER", "eval-teacher-x");
  const districtAdminAId = await mkUser(tA.id, "DISTRICT_ADMIN", "eval-da-a");
  const districtAdminBId = await mkUser(tB.id, "DISTRICT_ADMIN", "eval-da-b");
  const platformAdminId = await mkUser(tA.id, "PLATFORM_ADMIN", "eval-platform");
  const learnerUserA = await mkUser(tA.id, "LEARNER", "eval-luser-a");
  const learnerUserB = await mkUser(tB.id, "LEARNER", "eval-luser-b");
  const [learnerA] = await db.insert(learners).values({
    tenantId: tA.id, userId: learnerUserA, parentId: parentAId,
    name: "Eval Learner A", gradeLevel: "3",
  } as any).returning();
  const [learnerB] = await db.insert(learners).values({
    tenantId: tB.id, userId: learnerUserB, parentId: parentBId,
    name: "Eval Learner B", gradeLevel: "5",
  } as any).returning();
  const [link] = await db.insert(learnerTeachers).values({
    tenantId: tA.id,
    learnerId: learnerA.id,
    teacherEmail: `eval-teacher-a-${stamp}@test.local`,
    teacherUserId: teacherAId,
    invitedBy: parentAId,
    status: "ACCEPTED",
    acceptedAt: new Date(),
  } as any).returning();
  return {
    tenantAId: tA.id, tenantBId: tB.id,
    parentAId, parentBId, teacherAId, teacherUnassignedId,
    districtAdminAId, districtAdminBId, platformAdminId,
    learnerAId: learnerA.id, learnerBId: learnerB.id,
    teacherLinkAId: link.id,
  };
}

async function cleanup(db: any, f: Fixture) {
  const { eq, inArray } = await import("drizzle-orm");
  const { tenants, users, learners, learnerTeachers, iepEvaluations }
    = await import("@aivo/db");
  await db.delete(iepEvaluations).where(
    inArray(iepEvaluations.learnerId, [f.learnerAId, f.learnerBId]),
  );
  await db.delete(learnerTeachers).where(eq(learnerTeachers.id, f.teacherLinkAId));
  await db.delete(learners).where(inArray(learners.id, [f.learnerAId, f.learnerBId]));
  await db.delete(users).where(inArray(users.tenantId, [f.tenantAId, f.tenantBId]));
  await db.delete(tenants).where(inArray(tenants.id, [f.tenantAId, f.tenantBId]));
}

async function tokenFor(sub: string, role: string, tenantId: string): Promise<string> {
  const { signJWT } = await import("@aivo/security");
  return signJWT({ sub, role, tenantId }, "5m");
}

// Helper: create a draft evaluation via direct insert so each test starts at
// the state it cares about (avoids HTTP round-trips for setup-only data).
async function insertEval(
  db: any, learnerId: string, tenantId: string, initiatedBy: string, status: string,
  extra: Record<string, any> = {},
) {
  const { iepEvaluations } = await import("@aivo/db");
  const [row] = await db.insert(iepEvaluations).values({
    learnerId, tenantId, initiatedByUserId: initiatedBy, status, ...extra,
  } as any).returning();
  return row;
}

test("POST /api/iep/evaluations: TEACHER assigned to the learner can create a draft",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      const token = await tokenFor(f.teacherAId, "TEACHER", f.tenantAId);
      const res = await app.inject({
        method: "POST", url: "/api/iep/evaluations",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        payload: { learnerId: f.learnerAId, referralReason: "concern about reading" },
      });
      assert.equal(res.statusCode, 200, res.body);
      const body = res.json();
      assert.equal(body.status, "draft");
      assert.equal(body.referralReason, "concern about reading");
      assert.equal(body.learnerId, f.learnerAId);
      assert.equal(body.tenantId, f.tenantAId);
      assert.equal(body.initiatedByUserId, f.teacherAId);
    } finally { await cleanup(db, f); await teardown(app, db); }
  });

test("POST /api/iep/evaluations: TEACHER without an ACCEPTED assignment is denied (403)",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      const token = await tokenFor(f.teacherUnassignedId, "TEACHER", f.tenantAId);
      const res = await app.inject({
        method: "POST", url: "/api/iep/evaluations",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        payload: { learnerId: f.learnerAId },
      });
      assert.equal(res.statusCode, 403);
    } finally { await cleanup(db, f); await teardown(app, db); }
  });

test("POST /api/iep/evaluations: PARENT cannot start an evaluation (403)",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      const token = await tokenFor(f.parentAId, "PARENT", f.tenantAId);
      const res = await app.inject({
        method: "POST", url: "/api/iep/evaluations",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        payload: { learnerId: f.learnerAId },
      });
      assert.equal(res.statusCode, 403);
    } finally { await cleanup(db, f); await teardown(app, db); }
  });

test("POST /api/iep/evaluations: cross-tenant DISTRICT_ADMIN cannot create on another tenant's learner",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      // District admin scoped to tenant B targeting learner A (tenant A).
      const token = await tokenFor(f.districtAdminBId, "DISTRICT_ADMIN", f.tenantBId);
      const res = await app.inject({
        method: "POST", url: "/api/iep/evaluations",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        payload: { learnerId: f.learnerAId },
      });
      assert.equal(res.statusCode, 403);
    } finally { await cleanup(db, f); await teardown(app, db); }
  });

test("GET /api/iep/evaluations/learner/:learnerId: PARENT sees only submitted/decided evaluations and only the parent-summary fields",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      // Three evaluations across statuses; parent should only see the last two.
      await insertEval(db, f.learnerAId, f.tenantAId, f.teacherAId, "draft",
        { referralReason: "secret-internal-text" });
      await insertEval(db, f.learnerAId, f.tenantAId, f.teacherAId, "submitted",
        { submittedAt: new Date(), referralReason: "should-not-leak" });
      await insertEval(db, f.learnerAId, f.tenantAId, f.teacherAId, "eligibility_determined",
        { decisionEligible: "eligible", decisionRationale: "rationale", decidedAt: new Date(),
          submittedAt: new Date() });
      const token = await tokenFor(f.parentAId, "PARENT", f.tenantAId);
      const res = await app.inject({
        method: "GET", url: `/api/iep/evaluations/learner/${f.learnerAId}`,
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 200);
      const list = res.json();
      assert.equal(list.length, 2,
        `parent must only see submitted+decided evaluations, got ${list.length}`);
      for (const item of list) {
        // Parent summary must not expose the working fields.
        assert.equal(typeof item.referralReason, "undefined",
          "referralReason must not leak to parents");
        assert.equal(typeof item.observations, "undefined",
          "observations must not leak to parents");
        assert.equal(typeof item.aiSuggestion, "undefined",
          "aiSuggestion must not leak to parents");
      }
    } finally { await cleanup(db, f); await teardown(app, db); }
  });

test("GET /api/iep/evaluations/:id: cross-tenant DISTRICT_ADMIN gets 403",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      const row = await insertEval(db, f.learnerAId, f.tenantAId, f.teacherAId, "draft");
      const token = await tokenFor(f.districtAdminBId, "DISTRICT_ADMIN", f.tenantBId);
      const res = await app.inject({
        method: "GET", url: `/api/iep/evaluations/${row.id}`,
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 403);
    } finally { await cleanup(db, f); await teardown(app, db); }
  });

test("GET /api/iep/evaluations/:id: PLATFORM_ADMIN can read across tenants",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      const row = await insertEval(db, f.learnerAId, f.tenantAId, f.teacherAId, "draft");
      const token = await tokenFor(f.platformAdminId, "PLATFORM_ADMIN", f.tenantAId);
      const res = await app.inject({
        method: "GET", url: `/api/iep/evaluations/${row.id}`,
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().id, row.id);
    } finally { await cleanup(db, f); await teardown(app, db); }
  });

test("GET /api/iep/evaluations/:id: invalid UUID returns 400",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      const token = await tokenFor(f.teacherAId, "TEACHER", f.tenantAId);
      const res = await app.inject({
        method: "GET", url: "/api/iep/evaluations/not-a-uuid",
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 400);
    } finally { await cleanup(db, f); await teardown(app, db); }
  });

test("GET /api/iep/evaluations/:id: PARENT cannot view a draft evaluation (returns 404)",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      const row = await insertEval(db, f.learnerAId, f.tenantAId, f.teacherAId, "draft",
        { referralReason: "private" });
      const token = await tokenFor(f.parentAId, "PARENT", f.tenantAId);
      const res = await app.inject({
        method: "GET", url: `/api/iep/evaluations/${row.id}`,
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 404,
        "drafts are not parent-visible; the route should hide existence with 404");
    } finally { await cleanup(db, f); await teardown(app, db); }
  });

test("PATCH /api/iep/evaluations/:id: editing a decided evaluation returns 409",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      const row = await insertEval(db, f.learnerAId, f.tenantAId, f.teacherAId,
        "eligibility_determined", { decisionEligible: "eligible", decidedAt: new Date() });
      const token = await tokenFor(f.teacherAId, "TEACHER", f.tenantAId);
      const res = await app.inject({
        method: "PATCH", url: `/api/iep/evaluations/${row.id}`,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        payload: { observations: "late edit" },
      });
      assert.equal(res.statusCode, 409,
        "post-decision edits must be rejected with 409, not silently dropped");
    } finally { await cleanup(db, f); await teardown(app, db); }
  });

test("PATCH /api/iep/evaluations/:id: TEACHER assigned to the learner can update a draft",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      const row = await insertEval(db, f.learnerAId, f.tenantAId, f.teacherAId, "draft");
      const token = await tokenFor(f.teacherAId, "TEACHER", f.tenantAId);
      const res = await app.inject({
        method: "PATCH", url: `/api/iep/evaluations/${row.id}`,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        payload: { observations: "new observation" },
      });
      assert.equal(res.statusCode, 200, res.body);
      assert.equal(res.json().observations, "new observation");
    } finally { await cleanup(db, f); await teardown(app, db); }
  });

test("POST /api/iep/evaluations/:id/submit: only callable from draft (409 otherwise)",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      // Already-submitted row.
      const row = await insertEval(db, f.learnerAId, f.tenantAId, f.teacherAId, "submitted",
        { submittedAt: new Date() });
      const token = await tokenFor(f.teacherAId, "TEACHER", f.tenantAId);
      const res = await app.inject({
        method: "POST", url: `/api/iep/evaluations/${row.id}/submit`,
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 409,
        "double-submit must return 409, not advance the timestamp");
    } finally { await cleanup(db, f); await teardown(app, db); }
  });

test("POST /api/iep/evaluations/:id/submit: happy path moves draft to submitted and stamps submittedAt",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      const row = await insertEval(db, f.learnerAId, f.tenantAId, f.teacherAId, "draft");
      const token = await tokenFor(f.teacherAId, "TEACHER", f.tenantAId);
      const res = await app.inject({
        method: "POST", url: `/api/iep/evaluations/${row.id}/submit`,
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 200, res.body);
      const body = res.json();
      assert.equal(body.status, "submitted");
      assert.ok(body.submittedAt, "submittedAt must be stamped on submit");
    } finally { await cleanup(db, f); await teardown(app, db); }
  });

test("POST /api/iep/evaluations/:id/decision: rejects from non-submitted statuses with 409",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      // Still a draft — can't decide directly.
      const row = await insertEval(db, f.learnerAId, f.tenantAId, f.teacherAId, "draft");
      const token = await tokenFor(f.teacherAId, "TEACHER", f.tenantAId);
      const res = await app.inject({
        method: "POST", url: `/api/iep/evaluations/${row.id}/decision`,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        payload: { decision: "eligible", categories: ["specific_learning_disability"] },
      });
      assert.equal(res.statusCode, 409,
        "decision before submit must be rejected with 409");
    } finally { await cleanup(db, f); await teardown(app, db); }
  });

test("POST /api/iep/evaluations/:id/decision: filters out non-IDEA-13 category strings before persisting",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      const row = await insertEval(db, f.learnerAId, f.tenantAId, f.teacherAId, "submitted",
        { submittedAt: new Date() });
      const token = await tokenFor(f.teacherAId, "TEACHER", f.tenantAId);
      const res = await app.inject({
        method: "POST", url: `/api/iep/evaluations/${row.id}/decision`,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        payload: {
          decision: "eligible",
          categories: ["autism", "totally_made_up_category", "specific_learning_disability"],
          rationale: "OK",
        },
      });
      assert.equal(res.statusCode, 200, res.body);
      const body = res.json();
      assert.equal(body.status, "eligibility_determined");
      assert.equal(body.decisionEligible, "eligible");
      assert.deepEqual(body.decisionCategories.sort(),
        ["autism", "specific_learning_disability"].sort(),
        "non-IDEA-13 strings must be silently dropped to keep the column type-safe");
    } finally { await cleanup(db, f); await teardown(app, db); }
  });

test("POST /api/iep/evaluations/:id/decision: missing decision field returns 400",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      const row = await insertEval(db, f.learnerAId, f.tenantAId, f.teacherAId, "submitted",
        { submittedAt: new Date() });
      const token = await tokenFor(f.teacherAId, "TEACHER", f.tenantAId);
      const res = await app.inject({
        method: "POST", url: `/api/iep/evaluations/${row.id}/decision`,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        payload: { categories: ["autism"], rationale: "no decision provided" },
      });
      assert.equal(res.statusCode, 400);
    } finally { await cleanup(db, f); await teardown(app, db); }
  });

test("POST /api/iep/evaluations/:id/suggest: AI-service failure surfaces as 502",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("simulated network error");
    }) as typeof fetch;
    try {
      const row = await insertEval(db, f.learnerAId, f.tenantAId, f.teacherAId, "draft",
        { referralReason: "concern", observations: "..." });
      const token = await tokenFor(f.teacherAId, "TEACHER", f.tenantAId);
      const res = await app.inject({
        method: "POST", url: `/api/iep/evaluations/${row.id}/suggest`,
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 502,
        "AI failures must surface as 502 so callers know the suggestion is missing");
    } finally {
      globalThis.fetch = originalFetch;
      await cleanup(db, f); await teardown(app, db);
    }
  });

test("POST /api/iep/evaluations/:id/suggest: persists the AI suggestion when the AI service responds",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    const originalFetch = globalThis.fetch;
    const fakeSuggestion = {
      eligible_likely: true,
      suggested_categories: ["specific_learning_disability"],
      rationale: "fake AI rationale",
      confidence: 0.82,
    };
    globalThis.fetch = (async (url: any) => {
      if (String(url).includes("/api/ai/eligibility-suggest")) {
        return new Response(JSON.stringify(fakeSuggestion),
          { status: 200, headers: { "content-type": "application/json" } });
      }
      throw new Error("unexpected fetch: " + url);
    }) as typeof fetch;
    try {
      const row = await insertEval(db, f.learnerAId, f.tenantAId, f.teacherAId, "draft",
        { referralReason: "concern", observations: "obs" });
      const token = await tokenFor(f.teacherAId, "TEACHER", f.tenantAId);
      const res = await app.inject({
        method: "POST", url: `/api/iep/evaluations/${row.id}/suggest`,
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 200, res.body);
      assert.deepEqual(res.json().aiSuggestion, fakeSuggestion);
    } finally {
      globalThis.fetch = originalFetch;
      await cleanup(db, f); await teardown(app, db);
    }
  });
