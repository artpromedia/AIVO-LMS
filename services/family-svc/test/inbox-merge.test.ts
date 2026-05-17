/**
 * Tests for the global inbox/bell — task #18.
 *
 * The /api/family/inbox/:parentId endpoint merges legacy
 * `parent_notifications` rows with the IEP `parent_in_app_notifications`
 * pipeline so the dashboard bell badge reflects every unread item across
 * every learner. The merged shape and combined unread count are the
 * contract the parent dashboard layout depends on; these tests lock that
 * contract in.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { createDb } = await import("@aivo/db");
  const { initKeys } = await import("@aivo/security");
  const { registerParentDashboardRoutes } = await import("../src/routes/parent-dashboard.js");
  await initKeys();
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify({ logger: false });
  (app as any).db = db;
  await registerParentDashboardRoutes(app);
  await app.ready();
  return { app, db };
}

async function teardown(app: any, db: any) {
  await app.close();
  try { await (db as any).$client?.end?.({ timeout: 2 }); } catch { /* ignore */ }
}

interface Fixture {
  tenantA: string;
  parentA: string;
  parentB: string;
  learnerA: string;
}

async function seed(db: any): Promise<Fixture> {
  const { tenants, users, learners } = await import("@aivo/db");
  const stamp = Date.now();
  const [t] = await db.insert(tenants).values({
    name: `inbox-merge-${stamp}`, type: "B2B_DISTRICT",
  } as any).returning();
  const mkUser = async (role: string, name: string) => {
    const [u] = await db.insert(users).values({
      tenantId: t.id, name, role, email: `${name}-${stamp}@test.local`,
    } as any).returning();
    return u.id as string;
  };
  const parentA      = await mkUser("PARENT", "im-parent-a");
  const parentB      = await mkUser("PARENT", "im-parent-b");
  const learnerUser  = await mkUser("LEARNER", "im-luser");
  const [learner] = await db.insert(learners).values({
    tenantId: t.id, userId: learnerUser, parentId: parentA,
    name: "Inbox Merge Learner",
  } as any).returning();
  return { tenantA: t.id, parentA, parentB, learnerA: learner.id };
}

async function cleanup(db: any, f: Fixture) {
  const { eq, inArray } = await import("drizzle-orm");
  const { tenants, users, learners, parentNotifications, parentInAppNotifications }
    = await import("@aivo/db");
  await db.delete(parentNotifications).where(
    inArray(parentNotifications.parentId, [f.parentA, f.parentB]),
  );
  await db.delete(parentInAppNotifications).where(
    inArray(parentInAppNotifications.parentId, [f.parentA, f.parentB]),
  );
  await db.delete(learners).where(eq(learners.id, f.learnerA));
  await db.delete(users).where(eq(users.tenantId, f.tenantA));
  await db.delete(tenants).where(eq(tenants.id, f.tenantA));
}

async function tokenFor(sub: string, role: string, tenantId: string) {
  const { signJWT } = await import("@aivo/security");
  return signJWT({ sub, role, tenantId }, "5m");
}

async function seedLegacyRow(db: any, parentId: string, opts: { title: string; type?: string; readAt?: Date }) {
  const { parentNotifications } = await import("@aivo/db");
  const [row] = await db.insert(parentNotifications).values({
    parentId, type: opts.type || "milestone",
    title: opts.title, body: "legacy body", urgency: "normal",
    readAt: opts.readAt || null,
  } as any).returning();
  return row.id as string;
}

async function seedIepRow(db: any, parentId: string, learnerId: string, opts: { title: string; readAt?: Date }) {
  const { parentInAppNotifications } = await import("@aivo/db");
  const [row] = await db.insert(parentInAppNotifications).values({
    parentId, learnerId,
    category: "progress_notes",
    template: "iep_progress_note",
    title: opts.title,
    body: "iep body",
    link: `/dashboard/parent/learner/${learnerId}/iep`,
    readAt: opts.readAt || null,
  } as any).returning();
  return row.id as string;
}

test("inbox: merged feed contains both legacy and IEP rows, sorted newest-first", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    await seedLegacyRow(db, f.parentA, { title: "Legacy oldest" });
    await new Promise(r => setTimeout(r, 5));
    await seedIepRow(db, f.parentA, f.learnerA, { title: "IEP middle" });
    await new Promise(r => setTimeout(r, 5));
    await seedLegacyRow(db, f.parentA, { title: "Legacy newest" });

    const token = await tokenFor(f.parentA, "PARENT", f.tenantA);
    const res = await app.inject({
      method: "GET",
      url: `/api/family/inbox/${f.parentA}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    const titles = (body.items as Array<{ title: string }>).map((i) => i.title);
    assert.deepEqual(titles, ["Legacy newest", "IEP middle", "Legacy oldest"]);
    assert.equal(body.unreadCount, 3, "all three rows are unread");

    const sources = (body.items as Array<{ source: string }>).map((i) => i.source);
    assert.deepEqual(sources, ["family", "iep", "family"]);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("inbox: unreadCount sums BOTH tables", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    await seedLegacyRow(db, f.parentA, { title: "Legacy 1" });
    await seedLegacyRow(db, f.parentA, { title: "Legacy 2" });
    await seedIepRow(db, f.parentA, f.learnerA, { title: "IEP 1" });
    await seedIepRow(db, f.parentA, f.learnerA, { title: "IEP 2" });
    // One read row each — must NOT be in the unread total.
    await seedLegacyRow(db, f.parentA, { title: "Legacy read", readAt: new Date() });
    await seedIepRow(db, f.parentA, f.learnerA, { title: "IEP read", readAt: new Date() });

    const token = await tokenFor(f.parentA, "PARENT", f.tenantA);
    const res = await app.inject({
      method: "GET",
      url: `/api/family/inbox/${f.parentA}?filter=unread`,
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().unreadCount, 4);
    assert.equal((res.json().items as any[]).length, 4);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("inbox: parent A cannot read parent B's inbox", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    await seedIepRow(db, f.parentB, f.learnerA, { title: "B-only IEP" });
    const tokenA = await tokenFor(f.parentA, "PARENT", f.tenantA);
    const res = await app.inject({
      method: "GET",
      url: `/api/family/inbox/${f.parentB}`,
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.statusCode, 403);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("mark-read: works for IEP rows by id (no source param needed)", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const iepId = await seedIepRow(db, f.parentA, f.learnerA, { title: "IEP unread" });
    const token = await tokenFor(f.parentA, "PARENT", f.tenantA);

    const res = await app.inject({
      method: "PUT",
      url: `/api/family/inbox/${iepId}/read`,
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 200);

    const { parentInAppNotifications } = await import("@aivo/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(parentInAppNotifications)
      .where(eq(parentInAppNotifications.id, iepId));
    assert.ok(row.readAt instanceof Date, "readAt must be set");
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("mark-read: parent B cannot mark parent A's IEP rows", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const iepId = await seedIepRow(db, f.parentA, f.learnerA, { title: "A's IEP" });
    const tokenB = await tokenFor(f.parentB, "PARENT", f.tenantA);
    const res = await app.inject({
      method: "PUT",
      url: `/api/family/inbox/${iepId}/read`,
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(res.statusCode, 403);

    const { parentInAppNotifications } = await import("@aivo/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(parentInAppNotifications)
      .where(eq(parentInAppNotifications.id, iepId));
    assert.equal(row.readAt, null, "row must remain unread after a forbidden attempt");
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("dismiss: IEP rows have no dismissed_at column, so dismiss falls back to mark-read", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const iepId = await seedIepRow(db, f.parentA, f.learnerA, { title: "IEP to dismiss" });
    const token = await tokenFor(f.parentA, "PARENT", f.tenantA);
    const res = await app.inject({
      method: "PUT",
      url: `/api/family/inbox/${iepId}/dismiss`,
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 200);

    const { parentInAppNotifications } = await import("@aivo/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(parentInAppNotifications)
      .where(eq(parentInAppNotifications.id, iepId));
    assert.ok(row.readAt instanceof Date,
      "dismiss on an IEP row must at least mark it read so it leaves the unread feed");
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("inbox: IEP rows expose actionUrl that links to the learner's IEP page", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    await seedIepRow(db, f.parentA, f.learnerA, { title: "Linkable" });
    const token = await tokenFor(f.parentA, "PARENT", f.tenantA);
    const res = await app.inject({
      method: "GET",
      url: `/api/family/inbox/${f.parentA}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    const items = res.json().items as Array<{ source: string; actionUrl: string; learnerId: string }>;
    const iep = items.find((i) => i.source === "iep");
    assert.ok(iep);
    assert.equal(iep!.learnerId, f.learnerA);
    assert.match(iep!.actionUrl, /\/dashboard\/parent\/learner\/[0-9a-f-]+\/iep$/);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});
