/**
 * Teacher-assessment route authz + persistence contract (Sprint C-07 —
 * the route already existed; this is the test that was missing).
 *
 * Fastify inject + real signed JWTs (@aivo/security dev keys) + a recording
 * fake of the Drizzle handle, dispatching rows per table:
 *   - connected teacher (ACCEPTED learner_teachers link) can submit
 *   - teacher WITHOUT a link gets 403
 *   - parent cannot submit
 *   - SPED_LEAD / DISTRICT_ADMIN in-tenant can submit
 *   - status route reports the latest completed row
 *   - missing auth / invalid learnerId are rejected
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { signJWT } from "@aivo/security";
import { learners, learnerTeachers, teacherAssessments } from "@aivo/db";
import { registerTeacherAssessmentRoutes } from "../src/routes/teacher-assessment.js";

const TENANT = "11111111-1111-4111-8111-111111111111";
const LEARNER = "22222222-2222-4222-8222-222222222222";
const TEACHER = "33333333-3333-4333-8333-333333333333";
const STRANGER = "44444444-4444-4444-8444-444444444444";
const PARENT = "55555555-5555-4555-8555-555555555555";

interface FakeRows {
  learners: Array<Record<string, unknown>>;
  links: Array<Record<string, unknown>>;
  assessments: Array<Record<string, unknown>>;
}

/** Thenable query chain resolving the table's rows; records inserts. */
function fakeDb(rows: FakeRows) {
  const inserted: Record<string, unknown>[] = [];
  const rowsFor = (table: unknown): Array<Record<string, unknown>> => {
    if (table === learners) return rows.learners;
    if (table === learnerTeachers) return rows.links;
    if (table === teacherAssessments) return rows.assessments;
    return [];
  };
  const chain = (result: Array<Record<string, unknown>>) => {
    const c: Record<string, unknown> = {};
    c.where = () => c;
    c.orderBy = () => c;
    c.limit = () => c;
    c.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject);
    return c;
  };
  const db = {
    select: () => ({ from: (table: unknown) => chain(rowsFor(table)) }),
    insert: (table: unknown) => ({
      values: (v: Record<string, unknown>) => {
        assert.equal(table, teacherAssessments);
        inserted.push(v);
        return { returning: async () => [{ id: "tea-1", ...v }] };
      },
    }),
  };
  return { db, inserted };
}

async function buildApp(rows: FakeRows) {
  const app = Fastify({ logger: false });
  (app as unknown as { db: unknown }).db = fakeDb(rows).db;
  await registerTeacherAssessmentRoutes(app);
  await app.ready();
  return app;
}

async function buildAppRecording(rows: FakeRows) {
  const fake = fakeDb(rows);
  const app = Fastify({ logger: false });
  (app as unknown as { db: unknown }).db = fake.db;
  await registerTeacherAssessmentRoutes(app);
  await app.ready();
  return { app, inserted: fake.inserted };
}

const BASE_ROWS: FakeRows = {
  learners: [{ tenantId: TENANT }],
  links: [{ learnerId: LEARNER, teacherUserId: TEACHER, status: "ACCEPTED" }],
  assessments: [],
};

function token(sub: string, role: string, tenantId = TENANT) {
  return signJWT({ sub, role, tenantId });
}

test("connected teacher can submit and the row persists their input", async () => {
  const { app, inserted } = await buildAppRecording(BASE_ROWS);
  const res = await app.inject({
    method: "POST",
    url: "/api/assessments/teacher",
    headers: { authorization: `Bearer ${await token(TEACHER, "TEACHER")}` },
    payload: {
      learnerId: LEARNER,
      teacherRole: "General Ed Teacher",
      gradeLevel: "3-5",
      subjectArea: "math",
      strengths: ["strong number sense"],
      challenges: ["loses focus in long blocks"],
      accommodations: ["chunked directions"],
      observations: "Best in the morning.",
      recommendedFocusAreas: ["multi-step word problems"],
      additionalResponses: { planContext: "iep" },
    },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0]!.teacherRole, "General Ed Teacher");
  assert.equal(inserted[0]!.gradeLevel, "3-5");
  assert.equal(inserted[0]!.tenantId, TENANT);
  assert.equal(inserted[0]!.submittedBy, TEACHER);
  assert.ok(inserted[0]!.completedAt instanceof Date);
  await app.close();
});

test("teacher WITHOUT an accepted link gets 403", async () => {
  const app = await buildApp({ ...BASE_ROWS, links: [] });
  const res = await app.inject({
    method: "POST",
    url: "/api/assessments/teacher",
    headers: { authorization: `Bearer ${await token(STRANGER, "TEACHER")}` },
    payload: { learnerId: LEARNER, strengths: ["x"] },
  });
  assert.equal(res.statusCode, 403);
  await app.close();
});

test("parent cannot submit a teacher assessment", async () => {
  const app = await buildApp(BASE_ROWS);
  const res = await app.inject({
    method: "POST",
    url: "/api/assessments/teacher",
    headers: { authorization: `Bearer ${await token(PARENT, "PARENT")}` },
    payload: { learnerId: LEARNER },
  });
  assert.equal(res.statusCode, 403);
  await app.close();
});

test("SPED_LEAD in the learner's tenant can submit", async () => {
  const app = await buildApp(BASE_ROWS);
  const res = await app.inject({
    method: "POST",
    url: "/api/assessments/teacher",
    headers: { authorization: `Bearer ${await token(STRANGER, "SPED_LEAD")}` },
    payload: { learnerId: LEARNER },
  });
  assert.equal(res.statusCode, 200);
  await app.close();
});

test("DISTRICT_ADMIN in the learner's tenant can submit; out-of-tenant cannot", async () => {
  const inTenant = await buildApp(BASE_ROWS);
  const okRes = await inTenant.inject({
    method: "POST",
    url: "/api/assessments/teacher",
    headers: { authorization: `Bearer ${await token(STRANGER, "DISTRICT_ADMIN")}` },
    payload: { learnerId: LEARNER },
  });
  assert.equal(okRes.statusCode, 200);
  await inTenant.close();

  const otherTenant = await buildApp(BASE_ROWS);
  const denyRes = await otherTenant.inject({
    method: "POST",
    url: "/api/assessments/teacher",
    headers: {
      authorization: `Bearer ${await token(STRANGER, "DISTRICT_ADMIN", "99999999-9999-4999-8999-999999999999")}`,
    },
    payload: { learnerId: LEARNER },
  });
  assert.equal(denyRes.statusCode, 403);
  await otherTenant.close();
});

test("missing auth and invalid learnerId are rejected", async () => {
  const app = await buildApp(BASE_ROWS);
  const noAuth = await app.inject({
    method: "POST",
    url: "/api/assessments/teacher",
    payload: { learnerId: LEARNER },
  });
  assert.equal(noAuth.statusCode, 401);
  const badId = await app.inject({
    method: "POST",
    url: "/api/assessments/teacher",
    headers: { authorization: `Bearer ${await token(TEACHER, "TEACHER")}` },
    payload: { learnerId: "not-a-uuid" },
  });
  assert.equal(badId.statusCode, 400);
  await app.close();
});

test("status route reports the latest completed assessment", async () => {
  const completedAt = new Date("2026-06-01T00:00:00.000Z");
  const app = await buildApp({
    ...BASE_ROWS,
    assessments: [
      { id: "tea-9", completedAt, createdAt: completedAt, teacherRole: "Special Ed Teacher" },
    ],
  });
  const res = await app.inject({
    method: "GET",
    url: `/api/assessments/teacher/${LEARNER}/status`,
    headers: { authorization: `Bearer ${await token(TEACHER, "TEACHER")}` },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.completed, true);
  assert.equal(body.teacherRole, "Special Ed Teacher");
  await app.close();
});
