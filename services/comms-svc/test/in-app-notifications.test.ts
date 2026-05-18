/**
 * Integration tests for the in-app notification endpoints in comms-svc.
 *
 * Covers:
 *   - POST /api/comms/internal/in-app-notify   (assessment-svc → comms-svc)
 *       requires the internal service key; persists a row.
 *   - GET  /api/comms/in-app-notifications     (parent reads their inbox)
 *       parents only see their own rows; learnerId + unread filters work.
 *   - POST /api/comms/in-app-notifications/mark-read
 *       parents can mark specific ids read or `all: true`; never another
 *       parent's rows.
 *
 * The tests are DB-backed (skip when DATABASE_URL is absent) and exercise
 * the actual fastify route handler via app.inject. They lock in the
 * preference-gated, per-parent-isolated contract that the parent dashboard
 * unread badge depends on, so a future refactor can't quietly leak
 * another parent's inbox.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || "aivo-internal-dev-key";

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { createDb } = await import("@aivo/db");
  const { registerNotificationRoutes } = await import("../src/routes/notifications.js");
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify({ logger: false });
  registerNotificationRoutes(app, db);
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
  tenantA: string;
  parentA: string;
  parentB: string;
  learnerA1: string;
  learnerA2: string;
}

async function seed(db: any): Promise<Fixture> {
  const { tenants, users, learners } = await import("@aivo/db");
  const stamp = Date.now();

  const [t] = await db
    .insert(tenants)
    .values({
      name: `inapp-test-${stamp}`,
      type: "B2B_DISTRICT",
    } as any)
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

  const parentA = await mkUser("PARENT", "inapp-parent-a");
  const parentB = await mkUser("PARENT", "inapp-parent-b");
  const learnerUserA1 = await mkUser("LEARNER", "inapp-learner-a1");
  const learnerUserA2 = await mkUser("LEARNER", "inapp-learner-a2");

  const [lA1] = await db
    .insert(learners)
    .values({
      tenantId: t.id,
      userId: learnerUserA1,
      parentId: parentA,
      name: "InApp Learner A1",
    } as any)
    .returning();
  const [lA2] = await db
    .insert(learners)
    .values({
      tenantId: t.id,
      userId: learnerUserA2,
      parentId: parentA,
      name: "InApp Learner A2",
    } as any)
    .returning();

  return {
    tenantA: t.id,
    parentA,
    parentB,
    learnerA1: lA1.id,
    learnerA2: lA2.id,
  };
}

async function cleanup(db: any, f: Fixture) {
  const { eq, inArray } = await import("drizzle-orm");
  const { tenants, users, learners, parentInAppNotifications } = await import("@aivo/db");
  await db
    .delete(parentInAppNotifications)
    .where(inArray(parentInAppNotifications.parentId, [f.parentA, f.parentB]));
  await db.delete(learners).where(inArray(learners.id, [f.learnerA1, f.learnerA2]));
  await db.delete(users).where(eq(users.tenantId, f.tenantA));
  await db.delete(tenants).where(eq(tenants.id, f.tenantA));
}

async function tokenFor(sub: string, role: string, tenantId: string) {
  const { signJWT } = await import("@aivo/security");
  return signJWT({ sub, role, tenantId }, "5m");
}

async function postInternal(app: any, body: any, key = INTERNAL_KEY) {
  return app.inject({
    method: "POST",
    url: "/api/comms/internal/in-app-notify",
    headers: { "content-type": "application/json", "x-internal-key": key },
    payload: body,
  });
}

test(
  "in-app-notify: internal endpoint creates a row when key is correct",
  { skip: SKIP },
  async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      const res = await postInternal(app, {
        parentId: f.parentA,
        learnerId: f.learnerA1,
        category: "progress_notes",
        template: "iep_progress_note",
        title: "New progress note for Test",
        body: "Body snippet",
        link: "https://example/dashboard/parent/learner/x/iep",
      });
      assert.equal(res.statusCode, 200);
      const j = res.json();
      assert.equal(j.status, "created");
      assert.match(j.id, /[0-9a-f-]{36}/);

      const { parentInAppNotifications } = await import("@aivo/db");
      const { eq } = await import("drizzle-orm");
      const rows = await db
        .select()
        .from(parentInAppNotifications)
        .where(eq(parentInAppNotifications.parentId, f.parentA));
      assert.equal(rows.length, 1);
      assert.equal(rows[0].title, "New progress note for Test");
      assert.equal(rows[0].category, "progress_notes");
      assert.equal(rows[0].learnerId, f.learnerA1);
      assert.equal(rows[0].readAt, null);
    } finally {
      await cleanup(db, f);
      await teardown(app, db);
    }
  },
);

test("in-app-notify: internal endpoint rejects missing/invalid key", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const noKey = await app.inject({
      method: "POST",
      url: "/api/comms/internal/in-app-notify",
      headers: { "content-type": "application/json" },
      payload: { parentId: f.parentA, category: "reports", template: "x", title: "y" },
    });
    assert.equal(noKey.statusCode, 401);
    const badKey = await postInternal(
      app,
      {
        parentId: f.parentA,
        category: "reports",
        template: "x",
        title: "y",
      },
      "wrong-key",
    );
    assert.equal(badKey.statusCode, 401);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("in-app-notify: internal endpoint validates required fields", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const res = await postInternal(app, {
      parentId: f.parentA,
      // missing category/template/title
    });
    assert.equal(res.statusCode, 400);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test(
  "list: parent only sees their own notifications, never another parent's",
  { skip: SKIP },
  async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      await postInternal(app, {
        parentId: f.parentA,
        learnerId: f.learnerA1,
        category: "progress_notes",
        template: "iep_progress_note",
        title: "A's note",
      });
      await postInternal(app, {
        parentId: f.parentB,
        category: "reports",
        template: "iep_progress_report_sent",
        title: "B's report",
      });

      const tokenA = await tokenFor(f.parentA, "PARENT", f.tenantA);
      const resA = await app.inject({
        method: "GET",
        url: "/api/comms/in-app-notifications",
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(resA.statusCode, 200);
      const itemsA = resA.json().items as Array<{ title: string }>;
      assert.equal(itemsA.length, 1, "parentA must see exactly their one note");
      assert.equal(itemsA[0].title, "A's note");
      assert.equal(resA.json().unreadCount, 1);

      const tokenB = await tokenFor(f.parentB, "PARENT", f.tenantA);
      const resB = await app.inject({
        method: "GET",
        url: "/api/comms/in-app-notifications",
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      const itemsB = resB.json().items as Array<{ title: string }>;
      assert.equal(itemsB.length, 1, "parentB must see exactly their one report");
      assert.equal(itemsB[0].title, "B's report");
      // Critical isolation invariant — neither parent should see the other's row.
      assert.ok(!itemsA.some((i) => i.title === "B's report"));
      assert.ok(!itemsB.some((i) => i.title === "A's note"));
    } finally {
      await cleanup(db, f);
      await teardown(app, db);
    }
  },
);

test("list: unread + learnerId filters narrow the feed correctly", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    // 2 unread for A1, 1 unread for A2.
    await postInternal(app, {
      parentId: f.parentA,
      learnerId: f.learnerA1,
      category: "progress_notes",
      template: "iep_progress_note",
      title: "A1-note-1",
    });
    await postInternal(app, {
      parentId: f.parentA,
      learnerId: f.learnerA1,
      category: "progress_notes",
      template: "iep_progress_note",
      title: "A1-note-2",
    });
    await postInternal(app, {
      parentId: f.parentA,
      learnerId: f.learnerA2,
      category: "progress_notes",
      template: "iep_progress_note",
      title: "A2-note-1",
    });

    const token = await tokenFor(f.parentA, "PARENT", f.tenantA);

    const all = await app.inject({
      method: "GET",
      url: "/api/comms/in-app-notifications",
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal((all.json().items as any[]).length, 3);
    assert.equal(all.json().unreadCount, 3);

    const onlyA1 = await app.inject({
      method: "GET",
      url: `/api/comms/in-app-notifications?learnerId=${f.learnerA1}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal((onlyA1.json().items as any[]).length, 2);
    assert.equal(onlyA1.json().unreadCount, 2);

    const unreadOnly = await app.inject({
      method: "GET",
      url: `/api/comms/in-app-notifications?unread=true&learnerId=${f.learnerA1}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal((unreadOnly.json().items as any[]).length, 2);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test(
  "mark-read: marks all unread for a parent (optionally scoped to learner)",
  { skip: SKIP },
  async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      await postInternal(app, {
        parentId: f.parentA,
        learnerId: f.learnerA1,
        category: "progress_notes",
        template: "iep_progress_note",
        title: "A1-1",
      });
      await postInternal(app, {
        parentId: f.parentA,
        learnerId: f.learnerA2,
        category: "progress_notes",
        template: "iep_progress_note",
        title: "A2-1",
      });

      const token = await tokenFor(f.parentA, "PARENT", f.tenantA);

      // Scoped mark-read: only A1's unread should flip.
      const scoped = await app.inject({
        method: "POST",
        url: "/api/comms/in-app-notifications/mark-read",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        payload: { all: true, learnerId: f.learnerA1 },
      });
      assert.equal(scoped.statusCode, 200);
      assert.equal(scoped.json().updated, 1);

      const unreadAfter = await app.inject({
        method: "GET",
        url: "/api/comms/in-app-notifications?unread=true",
        headers: { Authorization: `Bearer ${token}` },
      });
      const left = unreadAfter.json().items as Array<{ title: string }>;
      assert.equal(left.length, 1);
      assert.equal(left[0].title, "A2-1", "A2's note must remain unread after scoped mark-read");
    } finally {
      await cleanup(db, f);
      await teardown(app, db);
    }
  },
);

test("mark-read: rejects if neither ids[] nor { all: true } supplied", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const token = await tokenFor(f.parentA, "PARENT", f.tenantA);
    const res = await app.inject({
      method: "POST",
      url: "/api/comms/in-app-notifications/mark-read",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      payload: {},
    });
    assert.equal(res.statusCode, 400);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("mark-read: parentB cannot mark parentA's notifications as read", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const created = await postInternal(app, {
      parentId: f.parentA,
      learnerId: f.learnerA1,
      category: "progress_notes",
      template: "iep_progress_note",
      title: "A1 note that B will try to nuke",
    });
    const noteId = created.json().id;

    const tokenB = await tokenFor(f.parentB, "PARENT", f.tenantA);
    const attack = await app.inject({
      method: "POST",
      url: "/api/comms/in-app-notifications/mark-read",
      headers: { Authorization: `Bearer ${tokenB}`, "content-type": "application/json" },
      payload: { ids: [noteId] },
    });
    assert.equal(attack.statusCode, 200);
    // The endpoint always succeeds, but it scopes the WHERE to the caller's
    // own parentId — so B's attempt updates 0 rows.
    assert.equal(attack.json().updated, 0);

    // Confirm A's note is still unread.
    const tokenA = await tokenFor(f.parentA, "PARENT", f.tenantA);
    const aList = await app.inject({
      method: "GET",
      url: "/api/comms/in-app-notifications?unread=true",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(aList.json().unreadCount, 1);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("list/mark-read: missing/invalid bearer token returns 401", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const noAuth = await app.inject({
      method: "GET",
      url: "/api/comms/in-app-notifications",
    });
    assert.equal(noAuth.statusCode, 401);

    const bad = await app.inject({
      method: "POST",
      url: "/api/comms/in-app-notifications/mark-read",
      headers: { Authorization: "Bearer not.a.jwt" },
      payload: { all: true },
    });
    assert.equal(bad.statusCode, 401);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});
