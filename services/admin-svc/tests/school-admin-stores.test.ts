/**
 * Durable school-admin persistence — route + store behavior.
 *
 * These tests inject the in-memory store implementations directly (via the
 * optional `store` argument on each register* function), so they exercise
 * the full Fastify wiring and store contract WITHOUT a database. The same
 * store interface is implemented by the Postgres variant used in production,
 * which is covered by integration tests when DATABASE_URL is set.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { signJWT } from "@aivo/security";
import { templateCsv } from "@aivo/learner-import";
import { registerClassroomRoutes } from "../src/routes/classrooms.js";
import { registerNotificationRoutes } from "../src/routes/notifications.js";
import { registerLearnerImportRoutes } from "../src/routes/learner-import.js";
import { InMemoryClassroomStore, selectClassroomStore } from "../src/stores/classroom-store.js";
import { InMemoryNotificationStore } from "../src/stores/notification-store.js";
import { InMemoryLearnerImportStore } from "../src/stores/learner-import-store.js";

const SCHOOL = "school-1";

async function adminAuth() {
  const token = await signJWT({
    sub: "00000000-0000-0000-0000-000000000001",
    role: "SCHOOL_ADMIN",
    email: "admin@aivo.dev",
    tenantId: null,
    name: "Test Admin",
  } as any);
  return { Authorization: `Bearer ${token}` };
}

const noopDb = {}; // audit logging is fire-and-forget and tolerates any db.

// --- classrooms ------------------------------------------------------------

test("classroom CRUD + roster persists through the injected store", async () => {
  const store = new InMemoryClassroomStore();
  const app = Fastify({ logger: false });
  registerClassroomRoutes(app, noopDb, store);
  await app.ready();
  const headers = await adminAuth();
  try {
    // Create
    const created = await app.inject({
      method: "POST",
      url: `/admin/schools/${SCHOOL}/classrooms`,
      headers,
      payload: { name: "Room A", grade: "5", teacherIds: ["t1"] },
    });
    assert.equal(created.statusCode, 201);
    const cls = created.json() as { id: string };
    assert.ok(cls.id.startsWith("cls_"));

    // The store actually holds it.
    assert.equal((await store.get(cls.id))?.name, "Room A");

    // List with teacher filter
    const list = await app.inject({
      method: "GET",
      url: `/admin/schools/${SCHOOL}/classrooms?teacherId=t1`,
      headers,
    });
    assert.equal(list.json().total, 1);

    // Roster add
    const roster = await app.inject({
      method: "POST",
      url: `/admin/schools/${SCHOOL}/classrooms/${cls.id}/roster`,
      headers,
      payload: { addLearnerIds: ["l1", "l2"], addCoTeacherIds: ["c1"] },
    });
    assert.equal(roster.statusCode, 200);
    const stored = await store.get(cls.id);
    assert.deepEqual(stored?.learnerIds, ["l1", "l2"]);
    assert.deepEqual(stored?.coTeacherIds, ["c1"]);

    // Delete
    const del = await app.inject({
      method: "DELETE",
      url: `/admin/schools/${SCHOOL}/classrooms/${cls.id}`,
      headers,
    });
    assert.equal(del.statusCode, 200);
    assert.equal(await store.get(cls.id), undefined);
  } finally {
    await app.close();
  }
});

test("classroom routes reject a cross-school id with 404", async () => {
  const store = new InMemoryClassroomStore();
  await store.insert({
    id: "cls_x",
    schoolId: "other-school",
    name: "Elsewhere",
    grade: null,
    teacherIds: [],
    coTeacherIds: [],
    learnerIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const app = Fastify({ logger: false });
  registerClassroomRoutes(app, noopDb, store);
  await app.ready();
  const headers = await adminAuth();
  try {
    const res = await app.inject({
      method: "GET",
      url: `/admin/schools/${SCHOOL}/classrooms/cls_x`,
      headers,
    });
    assert.equal(res.statusCode, 404);
  } finally {
    await app.close();
  }
});

// --- notifications ---------------------------------------------------------

test("notification matrix seeds a default then persists an update", async () => {
  const store = new InMemoryNotificationStore();
  const app = Fastify({ logger: false });
  registerNotificationRoutes(app, noopDb, store);
  await app.ready();
  const headers = await adminAuth();
  try {
    const initial = await app.inject({
      method: "GET",
      url: `/admin/schools/${SCHOOL}/notifications`,
      headers,
    });
    assert.equal(initial.statusCode, 200);
    const body = initial.json() as { matrix: Record<string, Record<string, boolean>> };
    // Admin defaults on, teacher off.
    assert.equal(body.matrix.classroom_created.school_admin, true);
    assert.equal(body.matrix.classroom_created.teacher, false);

    const updated = { classroom_created: { teacher: true } };
    const put = await app.inject({
      method: "PUT",
      url: `/admin/schools/${SCHOOL}/notifications`,
      headers,
      payload: { matrix: updated },
    });
    assert.equal(put.statusCode, 200);
    assert.deepEqual(await store.getRaw(SCHOOL), updated);
  } finally {
    await app.close();
  }
});

// --- learner import --------------------------------------------------------

async function waitForJob(
  app: ReturnType<typeof Fastify>,
  headers: Record<string, string>,
  jobId: string,
): Promise<any> {
  for (let i = 0; i < 50; i++) {
    const res = await app.inject({
      method: "GET",
      url: `/admin/schools/${SCHOOL}/learners/import/${jobId}`,
      headers,
    });
    const body = res.json() as { status: string };
    if (body.status === "done" || body.status === "failed") return body;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("job did not finish");
}

test("learner import runs, persists rows, and is idempotent on re-run", async () => {
  const store = new InMemoryLearnerImportStore();
  const app = Fastify({ logger: false });
  registerLearnerImportRoutes(app, noopDb, store);
  await app.ready();
  const headers = await adminAuth();
  const csvText = templateCsv();
  try {
    // Dry-run sees both rows as adds (nothing imported yet).
    const dry = await app.inject({
      method: "POST",
      url: `/admin/schools/${SCHOOL}/learners/import/run`,
      headers,
      payload: { csvText, dryRun: true },
    });
    assert.equal(dry.json().adds, 2);
    assert.equal(dry.json().updates, 0);

    // Real run.
    const run = await app.inject({
      method: "POST",
      url: `/admin/schools/${SCHOOL}/learners/import/run`,
      headers,
      payload: { csvText },
    });
    const { jobId } = run.json() as { jobId: string };
    const done = await waitForJob(app, headers, jobId);
    assert.equal(done.status, "done");
    assert.equal(done.summary.created, 2);

    // Rows are now durable in the store.
    assert.equal((await store.existingExternalIds(SCHOOL)).size, 2);

    // A second dry-run now classifies both as updates.
    const dry2 = await app.inject({
      method: "POST",
      url: `/admin/schools/${SCHOOL}/learners/import/run`,
      headers,
      payload: { csvText, dryRun: true },
    });
    assert.equal(dry2.json().updates, 2);
    assert.equal(dry2.json().adds, 0);
  } finally {
    await app.close();
  }
});

// --- production safety guard ------------------------------------------------

test("selectClassroomStore refuses the in-memory store in production", () => {
  const prevEnv = process.env.NODE_ENV;
  const prevUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.env.NODE_ENV = "production";
  try {
    assert.throws(() => selectClassroomStore({}), /DATABASE_URL required in production/);
  } finally {
    process.env.NODE_ENV = prevEnv;
    if (prevUrl !== undefined) process.env.DATABASE_URL = prevUrl;
  }
});
