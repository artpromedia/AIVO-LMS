/**
 * Tests for `POST /api/family/teacher-insights` — the route that backs
 * the mobile (teacher) insight screen and the new web BFF
 * `/api/bff/teacher/insights` parity route.
 *
 * Contract pinned here:
 *   - 401 without a bearer
 *   - 400 with a missing learnerId/insightText
 *   - 403 when the caller has no access to the learner
 *   - 201 + persisted row in BOTH `teacher_insights` (canonical) AND
 *     `brain_insights` (mirrored for back-compat with brain-profile
 *     readers).
 *
 * Skips when DATABASE_URL is not set so the rest of the family-svc test
 * sweep can still run on a vanilla checkout — same skip pattern the
 * existing inbox-merge / collaboration tests use.
 */
process.env.TZ = "UTC";
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { createDb } = await import("@aivo/db");
  const { initKeys, signJWT } = await import("@aivo/security");
  const { registerFamilyGoalsRoutes } = await import("../src/routes/family-goals.js");
  await initKeys();
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify({ logger: false });
  (app as any).db = db;
  await registerFamilyGoalsRoutes(app);
  await app.ready();
  return { app, db, signJWT };
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
  teacherSub: string;
  outsiderSub: string;
  learnerId: string;
  otherLearnerId: string;
}

async function seed(db: any): Promise<Fixture> {
  const { tenants, users, learners, learnerTeachers } = await import("@aivo/db");
  const stamp = Date.now();
  const [t] = await db
    .insert(tenants)
    .values({ name: `ti-${stamp}`, type: "B2B_DISTRICT" } as any)
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
    return u.id as string;
  };
  const teacherSub = await mkUser("TEACHER", "ti-teacher");
  const outsiderSub = await mkUser("TEACHER", "ti-outsider");
  const parentSub = await mkUser("PARENT", "ti-parent");
  const luser1 = await mkUser("LEARNER", "ti-l1");
  const luser2 = await mkUser("LEARNER", "ti-l2");
  const [learner] = await db
    .insert(learners)
    .values({
      tenantId: t.id,
      userId: luser1,
      parentId: parentSub,
      name: "TI Learner",
    } as any)
    .returning();
  const [other] = await db
    .insert(learners)
    .values({
      tenantId: t.id,
      userId: luser2,
      parentId: parentSub,
      name: "TI Other Learner",
    } as any)
    .returning();

  // Grant the teacher an accepted collaboration link to learner #1 only.
  await db.insert(learnerTeachers).values({
    learnerId: learner.id,
    teacherUserId: teacherSub,
    status: "ACCEPTED",
  } as any);

  return {
    tenantId: t.id,
    teacherSub,
    outsiderSub,
    learnerId: learner.id,
    otherLearnerId: other.id,
  };
}

function mkToken(signJWT: any, sub: string, tenantId: string) {
  return signJWT({ sub, tenantId, role: "TEACHER" });
}

test("POST /api/family/teacher-insights — 401 without a bearer", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  try {
    const res = await app.inject({
      method: "POST",
      url: "/api/family/teacher-insights",
      payload: { learnerId: "00000000-0000-0000-0000-000000000000", insightText: "x" },
    });
    assert.equal(res.statusCode, 401);
  } finally {
    await teardown(app, db);
  }
});

test(
  "POST /api/family/teacher-insights — 400 when learnerId or insightText missing",
  { skip: SKIP },
  async () => {
    const { app, db, signJWT } = await bootstrap();
    try {
      const fx = await seed(db);
      const token = await mkToken(signJWT, fx.teacherSub, fx.tenantId);

      const r1 = await app.inject({
        method: "POST",
        url: "/api/family/teacher-insights",
        headers: { authorization: `Bearer ${token}` },
        payload: { insightText: "missing learner" },
      });
      assert.equal(r1.statusCode, 400);

      const r2 = await app.inject({
        method: "POST",
        url: "/api/family/teacher-insights",
        headers: { authorization: `Bearer ${token}` },
        payload: { learnerId: fx.learnerId, insightText: "   " },
      });
      assert.equal(r2.statusCode, 400);
    } finally {
      await teardown(app, db);
    }
  },
);

test(
  "POST /api/family/teacher-insights — 403 when the teacher has no link to the learner",
  { skip: SKIP },
  async () => {
    const { app, db, signJWT } = await bootstrap();
    try {
      const fx = await seed(db);
      const token = await mkToken(signJWT, fx.outsiderSub, fx.tenantId);
      const res = await app.inject({
        method: "POST",
        url: "/api/family/teacher-insights",
        headers: { authorization: `Bearer ${token}` },
        payload: { learnerId: fx.learnerId, insightText: "shouldn't land" },
      });
      assert.equal(res.statusCode, 403);
    } finally {
      await teardown(app, db);
    }
  },
);

test(
  "POST /api/family/teacher-insights — 201 persists to teacher_insights AND mirrors to brain_insights",
  { skip: SKIP },
  async () => {
    const { app, db, signJWT } = await bootstrap();
    try {
      const fx = await seed(db);
      const token = await mkToken(signJWT, fx.teacherSub, fx.tenantId);

      const res = await app.inject({
        method: "POST",
        url: "/api/family/teacher-insights",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          learnerId: fx.learnerId,
          insightText: "Engages deeply with visual fractions.",
          domain: "math",
        },
      });
      assert.equal(res.statusCode, 201);
      const body = res.json() as { insight: { id: string; insightText: string; status: string } };
      assert.ok(body.insight.id, "insight row returned with id");
      assert.equal(body.insight.insightText, "Engages deeply with visual fractions.");
      assert.equal(body.insight.status, "open");

      const { teacherInsights, brainInsights } = await import("@aivo/db");
      const { eq } = await import("drizzle-orm");

      const tiRows = await db
        .select()
        .from(teacherInsights)
        .where(eq(teacherInsights.id, body.insight.id));
      assert.equal(tiRows.length, 1, "row persisted to teacher_insights");
      assert.equal(tiRows[0].tenantId, fx.tenantId);
      assert.equal(tiRows[0].teacherUserId, fx.teacherSub);
      assert.equal(tiRows[0].learnerId, fx.learnerId);
      assert.equal(tiRows[0].domain, "math");

      const biRows = await db
        .select()
        .from(brainInsights)
        .where(eq(brainInsights.learnerId, fx.learnerId));
      const mirrored = biRows.find(
        (r: any) =>
          r.source === "teacher" &&
          r.sourceUserId === fx.teacherSub &&
          r.insightText === "Engages deeply with visual fractions.",
      );
      assert.ok(mirrored, "insight mirrored into brain_insights with source=teacher");
    } finally {
      await teardown(app, db);
    }
  },
);
