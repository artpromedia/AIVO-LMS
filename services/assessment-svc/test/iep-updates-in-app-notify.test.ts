/**
 * Integration tests for the in-app notification path that fires from
 * assessment-svc when an IEP event is created and the parent has
 * `inApp: true` for that category in their preferences.
 *
 * The assessment-svc → comms-svc dispatch is HTTP. We swap global.fetch
 * for a recorder so we can assert exactly what assessment-svc would have
 * sent without standing up comms-svc. The recorder also lets us verify
 * the OPPOSITE — that no in-app HTTP call is made when the parent has
 * opted out of inApp for the category.
 *
 * Email dispatch is also captured in the same recorder so we can
 * confirm the two channels are gated independently (a parent can opt
 * out of email and still receive in-app, and vice-versa).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;

interface Captured {
  url: string;
  method: string;
  template?: string;
  category?: string;
  parentId?: string;
  learnerId?: string;
  to?: string;
}

function installFetchRecorder(): { calls: Captured[]; restore: () => void } {
  const calls: Captured[] = [];
  const original = global.fetch;
  global.fetch = (async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url || String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({
      url,
      method: init?.method || "GET",
      template: body.template,
      category: body.category,
      parentId: body.parentId,
      learnerId: body.learnerId,
      to: body.to,
    });
    return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
  }) as any;
  return { calls, restore: () => { global.fetch = original; } };
}

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { createDb } = await import("@aivo/db");
  const { registerIepUpdatesRoutes } = await import("../src/routes/iep-updates.js");
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify({ logger: false });
  (app as any).db = db;
  await registerIepUpdatesRoutes(app);
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
  caseManagerA: string;
  learnerA: string;
  profileA: string;
}

async function seed(db: any): Promise<Fixture> {
  const { tenants, users, learners, iepProfiles, iepTeamMembers } = await import("@aivo/db");
  const stamp = Date.now();
  const [t] = await db.insert(tenants).values({
    name: `inapp-asmt-${stamp}`, type: "B2B_DISTRICT",
  } as any).returning();
  const mkUser = async (role: string, name: string, email: string) => {
    const [u] = await db.insert(users).values({
      tenantId: t.id, name, role, email,
    } as any).returning();
    return u.id as string;
  };
  const parentA      = await mkUser("PARENT",  "asmt-parent-a", `asmt-parent-${stamp}@test.local`);
  const caseManagerA = await mkUser("TEACHER", "asmt-cm-a",     `asmt-cm-${stamp}@test.local`);
  const learnerUser  = await mkUser("LEARNER", "asmt-luser-a",  `asmt-luser-${stamp}@test.local`);
  const [learner] = await db.insert(learners).values({
    tenantId: t.id, userId: learnerUser, parentId: parentA,
    name: "Notify Test Learner",
  } as any).returning();
  const [profile] = await db.insert(iepProfiles).values({
    learnerId: learner.id, gradeLevel: "5", placement: "general-education",
    source: "authored", lifecycleState: "finalised",
    reviewDate: new Date(Date.now() + 180 * 86_400_000),
  } as any).returning();
  await db.insert(iepTeamMembers).values([
    { iepProfileId: profile.id, userId: caseManagerA, role: "case_manager", addedBy: caseManagerA },
  ] as any);
  return { tenantA: t.id, parentA, caseManagerA, learnerA: learner.id, profileA: profile.id };
}

async function cleanup(db: any, f: Fixture) {
  const { eq, inArray } = await import("drizzle-orm");
  const {
    tenants, users, learners,
    iepProfiles, iepTeamMembers, iepProgressNotes,
    parentNotificationPreferences, parentInAppNotifications,
  } = await import("@aivo/db");
  await db.delete(parentInAppNotifications).where(eq(parentInAppNotifications.parentId, f.parentA));
  await db.delete(parentNotificationPreferences)
    .where(eq(parentNotificationPreferences.parentId, f.parentA));
  await db.delete(iepProgressNotes).where(eq(iepProgressNotes.iepProfileId, f.profileA));
  await db.delete(iepTeamMembers).where(eq(iepTeamMembers.iepProfileId, f.profileA));
  await db.delete(iepProfiles).where(eq(iepProfiles.id, f.profileA));
  await db.delete(learners).where(eq(learners.id, f.learnerA));
  await db.delete(users).where(inArray(users.id, [f.parentA, f.caseManagerA]));
  await db.delete(users).where(eq(users.tenantId, f.tenantA));
  await db.delete(tenants).where(eq(tenants.id, f.tenantA));
}

async function setPrefs(db: any, parentId: string, prefs: Record<string, { email?: boolean; inApp?: boolean }>) {
  const { parentNotificationPreferences } = await import("@aivo/db");
  await db.insert(parentNotificationPreferences).values({
    parentId, prefs,
  } as any).onConflictDoUpdate({
    target: parentNotificationPreferences.parentId,
    set: { prefs, updatedAt: new Date() },
  });
}

async function tokenFor(sub: string, role: string, tenantId: string) {
  const { signJWT } = await import("@aivo/security");
  return signJWT({ sub, role, tenantId }, "5m");
}

async function postNote(app: any, profileId: string, token: string, body: any) {
  return app.inject({
    method: "POST",
    url: `/api/iep/drafts/${profileId}/notes`,
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    payload: body,
  });
}

test("posting a parent-visible progress note creates an in-app notification when inApp=true", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  const recorder = installFetchRecorder();
  try {
    await setPrefs(db, f.parentA, {
      progress_notes: { email: false, inApp: true },
    });
    const token = await tokenFor(f.caseManagerA, "TEACHER", f.tenantA);
    const res = await postNote(app, f.profileA, token, {
      body: "Made great progress on reading fluency today.",
      visibility: "parent",
    });
    assert.equal(res.statusCode, 200);

    const inApp = recorder.calls.find((c) => c.url.includes("/api/comms/internal/in-app-notify"));
    assert.ok(inApp, "expected an in-app-notify HTTP call");
    assert.equal(inApp!.method, "POST");
    assert.equal(inApp!.template, "iep_progress_note");
    assert.equal(inApp!.category, "progress_notes");
    assert.equal(inApp!.parentId, f.parentA);
    assert.equal(inApp!.learnerId, f.learnerA);

    const email = recorder.calls.find((c) => c.url.includes("/api/comms/internal/iep-notify"));
    assert.ok(!email, "email path must NOT fire when prefs.email=false");
  } finally {
    recorder.restore();
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("posting a parent-visible note does NOT create an in-app notification when inApp=false", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  const recorder = installFetchRecorder();
  try {
    await setPrefs(db, f.parentA, {
      progress_notes: { email: true, inApp: false },
    });
    const token = await tokenFor(f.caseManagerA, "TEACHER", f.tenantA);
    const res = await postNote(app, f.profileA, token, {
      body: "Email-only update.",
      visibility: "parent",
    });
    assert.equal(res.statusCode, 200);

    const inApp = recorder.calls.find((c) => c.url.includes("/api/comms/internal/in-app-notify"));
    assert.ok(!inApp, "in-app channel must NOT fire when prefs.inApp=false");
    const email = recorder.calls.find((c) => c.url.includes("/api/comms/internal/iep-notify"));
    assert.ok(email, "email channel must still fire when prefs.email=true");
    assert.equal(email!.template, "iep_progress_note");
  } finally {
    recorder.restore();
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("team-only and internal-visibility notes never trigger any parent notification", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  const recorder = installFetchRecorder();
  try {
    await setPrefs(db, f.parentA, {
      progress_notes: { email: true, inApp: true },
    });
    const token = await tokenFor(f.caseManagerA, "TEACHER", f.tenantA);
    await postNote(app, f.profileA, token, { body: "Team-only note.", visibility: "team" });
    await postNote(app, f.profileA, token, { body: "Internal note.",  visibility: "internal" });

    const dispatched = recorder.calls.filter((c) =>
      c.url.includes("/api/comms/internal/in-app-notify")
      || c.url.includes("/api/comms/internal/iep-notify"));
    assert.equal(dispatched.length, 0,
      "non-parent-visible notes must NEVER trigger a parent channel");
  } finally {
    recorder.restore();
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("when both channels are off, no notification is sent at all", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  const recorder = installFetchRecorder();
  try {
    await setPrefs(db, f.parentA, {
      progress_notes: { email: false, inApp: false },
    });
    const token = await tokenFor(f.caseManagerA, "TEACHER", f.tenantA);
    const res = await postNote(app, f.profileA, token, {
      body: "Silent update.",
      visibility: "parent",
    });
    assert.equal(res.statusCode, 200);

    const dispatched = recorder.calls.filter((c) =>
      c.url.includes("/api/comms/internal/in-app-notify")
      || c.url.includes("/api/comms/internal/iep-notify"));
    assert.equal(dispatched.length, 0,
      "with both prefs off, neither channel may fire");
  } finally {
    recorder.restore();
    await cleanup(db, f);
    await teardown(app, db);
  }
});
