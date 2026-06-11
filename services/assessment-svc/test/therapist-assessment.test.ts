/**
 * Therapist-assessment route authz + persistence contract (Sprint 6).
 * Fastify inject + real signed JWTs (@aivo/security dev keys) + a recording
 * fake of the Drizzle handle, dispatching rows per table:
 *   - connected therapist (ACCEPTED link) can submit
 *   - therapist WITHOUT a link gets 403
 *   - parent cannot submit
 *   - SPED_LEAD in-tenant can submit
 *   - status route reports the latest completed row
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { signJWT } from "@aivo/security";
import { learners, learnerTherapists, therapistAssessments } from "@aivo/db";
import { registerTherapistAssessmentRoutes } from "../src/routes/therapist-assessment.js";

const TENANT = "11111111-1111-4111-8111-111111111111";
const LEARNER = "22222222-2222-4222-8222-222222222222";
const THERAPIST = "33333333-3333-4333-8333-333333333333";
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
    if (table === learnerTherapists) return rows.links;
    if (table === therapistAssessments) return rows.assessments;
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
        assert.equal(table, therapistAssessments);
        inserted.push(v);
        return { returning: async () => [{ id: "ta-1", ...v }] };
      },
    }),
  };
  return { db, inserted };
}

async function buildApp(rows: FakeRows) {
  const app = Fastify({ logger: false });
  (app as unknown as { db: unknown }).db = fakeDb(rows).db;
  await registerTherapistAssessmentRoutes(app);
  await app.ready();
  return app;
}

async function buildAppRecording(rows: FakeRows) {
  const fake = fakeDb(rows);
  const app = Fastify({ logger: false });
  (app as unknown as { db: unknown }).db = fake.db;
  await registerTherapistAssessmentRoutes(app);
  await app.ready();
  return { app, inserted: fake.inserted };
}

const BASE_ROWS: FakeRows = {
  learners: [{ tenantId: TENANT }],
  links: [{ learnerId: LEARNER, therapistUserId: THERAPIST, status: "ACCEPTED" }],
  assessments: [],
};

function token(sub: string, role: string, tenantId = TENANT) {
  return signJWT({ sub, role, tenantId });
}

test("connected therapist can submit and the row persists their input", async () => {
  const { app, inserted } = await buildAppRecording(BASE_ROWS);
  const res = await app.inject({
    method: "POST",
    url: "/api/assessments/therapist",
    headers: { authorization: `Bearer ${await token(THERAPIST, "THERAPIST")}` },
    payload: {
      learnerId: LEARNER,
      therapyDiscipline: "speech",
      areasOfFocus: ["articulation"],
      strengths: ["responds to modeling"],
      regulationStrategies: ["first-then boards"],
      observations: "Strong progress on /r/ blends.",
    },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0]!.therapyDiscipline, "speech");
  assert.equal(inserted[0]!.tenantId, TENANT);
  assert.equal(inserted[0]!.submittedBy, THERAPIST);
  assert.ok(inserted[0]!.completedAt instanceof Date);
  await app.close();
});

test("therapist WITHOUT an accepted link gets 403", async () => {
  const app = await buildApp({ ...BASE_ROWS, links: [] });
  const res = await app.inject({
    method: "POST",
    url: "/api/assessments/therapist",
    headers: { authorization: `Bearer ${await token(STRANGER, "THERAPIST")}` },
    payload: { learnerId: LEARNER, therapyDiscipline: "speech" },
  });
  assert.equal(res.statusCode, 403);
  await app.close();
});

test("parent cannot submit a therapist assessment", async () => {
  const app = await buildApp(BASE_ROWS);
  const res = await app.inject({
    method: "POST",
    url: "/api/assessments/therapist",
    headers: { authorization: `Bearer ${await token(PARENT, "PARENT")}` },
    payload: { learnerId: LEARNER, therapyDiscipline: "speech" },
  });
  assert.equal(res.statusCode, 403);
  await app.close();
});

test("SPED_LEAD in the learner's tenant can submit", async () => {
  const app = await buildApp(BASE_ROWS);
  const res = await app.inject({
    method: "POST",
    url: "/api/assessments/therapist",
    headers: { authorization: `Bearer ${await token(STRANGER, "SPED_LEAD")}` },
    payload: { learnerId: LEARNER },
  });
  assert.equal(res.statusCode, 200);
  await app.close();
});

test("invalid discipline and missing auth are rejected", async () => {
  const app = await buildApp(BASE_ROWS);
  const noAuth = await app.inject({
    method: "POST",
    url: "/api/assessments/therapist",
    payload: { learnerId: LEARNER },
  });
  assert.equal(noAuth.statusCode, 401);
  const badDiscipline = await app.inject({
    method: "POST",
    url: "/api/assessments/therapist",
    headers: { authorization: `Bearer ${await token(THERAPIST, "THERAPIST")}` },
    payload: { learnerId: LEARNER, therapyDiscipline: "chiropractic" },
  });
  assert.equal(badDiscipline.statusCode, 400);
  await app.close();
});

test("status route reports the latest completed assessment", async () => {
  const completedAt = new Date("2026-06-01T00:00:00.000Z");
  const app = await buildApp({
    ...BASE_ROWS,
    assessments: [
      { id: "ta-9", completedAt, createdAt: completedAt, therapyDiscipline: "occupational" },
    ],
  });
  const res = await app.inject({
    method: "GET",
    url: `/api/assessments/therapist/${LEARNER}/status`,
    headers: { authorization: `Bearer ${await token(THERAPIST, "THERAPIST")}` },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.completed, true);
  assert.equal(body.therapyDiscipline, "occupational");
  await app.close();
});
