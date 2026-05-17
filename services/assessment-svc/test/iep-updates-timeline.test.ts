/**
 * Regression tests for the parent-IEP "Updates" timeline endpoint.
 *
 * Two classes of bug led to these tests:
 *   1. Cross-tenant exposure — earlier the timeline route relied solely on
 *      team-membership and didn't first check the learner's tenant. A teacher
 *      in Tenant A could fetch a Tenant B learner's timeline by guessing a
 *      UUID. We now look up the learner first and require either parent,
 *      platform admin, district admin in the same tenant, or team member.
 *   2. Amendment "before" snapshot stored the proposed delta instead of the
 *      current persisted profile + goals, breaking the legal pre/post diff.
 *
 * The tests are DB-backed (skip when DATABASE_URL is missing) and exercise
 * the actual fastify route handler via app.inject so any future regression
 * to the access-control branches will fail loudly.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;

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
  // Drizzle holds the underlying postgres-js client on $client; closing it
  // releases the pool so node:test can exit instead of hanging on the
  // open sockets.
  try { await (db as any).$client?.end?.({ timeout: 2 }); } catch { /* ignore */ }
}

interface Fixture {
  tenantA: string;
  tenantB: string;
  parentA: string;
  teacherA: string;       // team member on the IEP
  outsiderA: string;      // same tenant, NOT on the team
  caseManagerA: string;
  teacherB: string;       // teacher in a different tenant
  platformAdmin: string;
  districtAdminA: string;
  learnerA: string;
  profileA: string;       // finalised IEP profile for learnerA
  goalA: string;
}

async function seed(db: any): Promise<Fixture> {
  const { tenants, users, learners, iepProfiles, iepGoals, iepTeamMembers }
    = await import("@aivo/db");

  const stamp = Date.now();
  const [tA] = await db.insert(tenants).values({
    name: `tl-test-A-${stamp}`, type: "B2B_DISTRICT",
  } as any).returning();
  const [tB] = await db.insert(tenants).values({
    name: `tl-test-B-${stamp}`, type: "B2B_DISTRICT",
  } as any).returning();

  const mkUser = async (tenantId: string | null, role: string, name: string) => {
    const [u] = await db.insert(users).values({
      tenantId, name, role,
      email: `${name}-${stamp}@test.local`,
    } as any).returning();
    return u.id as string;
  };

  const parentA      = await mkUser(tA.id, "PARENT",         "tl-parent-a");
  const teacherA     = await mkUser(tA.id, "TEACHER",        "tl-teacher-a");
  const outsiderA    = await mkUser(tA.id, "TEACHER",        "tl-outsider-a");
  const caseManagerA = await mkUser(tA.id, "TEACHER",        "tl-cm-a");
  const teacherB     = await mkUser(tB.id, "TEACHER",        "tl-teacher-b");
  const platformAdmin= await mkUser(null,  "PLATFORM_ADMIN", "tl-platform");
  const districtAdminA = await mkUser(tA.id, "DISTRICT_ADMIN", "tl-district-a");
  const learnerUser  = await mkUser(tA.id, "LEARNER",        "tl-learner-user-a");

  const [learner] = await db.insert(learners).values({
    tenantId: tA.id, userId: learnerUser, parentId: parentA,
    name: "Timeline Test Learner",
  } as any).returning();

  const [profile] = await db.insert(iepProfiles).values({
    learnerId: learner.id,
    gradeLevel: "5",
    placement: "general-education",
    accommodations: ["extra time"],
    source: "authored",
    lifecycleState: "finalised",
    reviewDate: new Date(Date.now() + 180 * 86_400_000),
  } as any).returning();

  const [goal] = await db.insert(iepGoals).values({
    learnerId: learner.id,
    iepProfileId: profile.id,
    goalText: "Original goal text",
    domain: "reading",
    baseline: "20%",
    targetCriteria: "80%",
  } as any).returning();

  await db.insert(iepTeamMembers).values([
    { iepProfileId: profile.id, userId: teacherA,     role: "teacher",      addedBy: caseManagerA },
    { iepProfileId: profile.id, userId: caseManagerA, role: "case_manager", addedBy: caseManagerA },
  ] as any);

  return {
    tenantA: tA.id, tenantB: tB.id,
    parentA, teacherA, outsiderA, caseManagerA, teacherB,
    platformAdmin, districtAdminA,
    learnerA: learner.id, profileA: profile.id, goalA: goal.id,
  };
}

async function cleanup(db: any, f: Fixture) {
  const { eq, inArray } = await import("drizzle-orm");
  const {
    tenants, users, learners,
    iepProfiles, iepGoals, iepTeamMembers,
    iepRevisions, iepAmendments,
    iepProgressNotes, iepProgressReports, iepReviewReminders,
  } = await import("@aivo/db");
  await db.delete(iepProgressNotes).where(eq(iepProgressNotes.iepProfileId, f.profileA));
  await db.delete(iepProgressReports).where(eq(iepProgressReports.iepProfileId, f.profileA));
  await db.delete(iepAmendments).where(eq(iepAmendments.iepProfileId, f.profileA));
  await db.delete(iepReviewReminders).where(eq(iepReviewReminders.iepProfileId, f.profileA));
  await db.delete(iepRevisions).where(eq(iepRevisions.iepProfileId, f.profileA));
  await db.delete(iepTeamMembers).where(eq(iepTeamMembers.iepProfileId, f.profileA));
  await db.delete(iepGoals).where(eq(iepGoals.iepProfileId, f.profileA));
  await db.delete(iepProfiles).where(eq(iepProfiles.id, f.profileA));
  await db.delete(learners).where(eq(learners.id, f.learnerA));
  const userIds = [
    f.parentA, f.teacherA, f.outsiderA, f.caseManagerA,
    f.teacherB, f.platformAdmin, f.districtAdminA,
  ];
  await db.delete(users).where(inArray(users.id, userIds));
  // Drop the learner user too — we don't track its id but it's the only
  // remaining user attached to tenantA from this test.
  await db.delete(users).where(eq(users.tenantId, f.tenantA));
  await db.delete(users).where(eq(users.tenantId, f.tenantB));
  await db.delete(tenants).where(inArray(tenants.id, [f.tenantA, f.tenantB]));
}

async function tokenFor(sub: string, role: string, tenantId: string): Promise<string> {
  const { signJWT } = await import("@aivo/security");
  return signJWT({ sub, role, tenantId }, "5m");
}

async function getTimeline(app: any, learnerId: string, token: string) {
  return app.inject({
    method: "GET",
    url: `/api/iep/learners/${learnerId}/timeline`,
    headers: { Authorization: `Bearer ${token}` },
  });
}

test("timeline: cross-tenant teacher in Tenant B is forbidden from Tenant A learner", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const token = await tokenFor(f.teacherB, "TEACHER", f.tenantB);
    const res = await getTimeline(app, f.learnerA, token);
    assert.equal(res.statusCode, 403,
      "teacher in a different tenant must NEVER read another tenant's timeline");
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("timeline: same-tenant teacher who isn't on the IEP team is forbidden", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const token = await tokenFor(f.outsiderA, "TEACHER", f.tenantA);
    const res = await getTimeline(app, f.learnerA, token);
    assert.equal(res.statusCode, 403,
      "shared tenant alone must not grant access — only IEP team members do");
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("timeline: parent of the learner can read their child's timeline", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const token = await tokenFor(f.parentA, "PARENT", f.tenantA);
    const res = await getTimeline(app, f.learnerA, token);
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.iepProfileId, f.profileA);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("timeline: IEP team member can read the timeline", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const token = await tokenFor(f.teacherA, "TEACHER", f.tenantA);
    const res = await getTimeline(app, f.learnerA, token);
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().iepProfileId, f.profileA);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("timeline: PLATFORM_ADMIN can read any tenant's timeline", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    // Note: deliberately giving the platform admin a *different* tenant id
    // to prove the role bypass — not the same-tenant branch — is what
    // grants access.
    const token = await tokenFor(f.platformAdmin, "PLATFORM_ADMIN", f.tenantB);
    const res = await getTimeline(app, f.learnerA, token);
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().iepProfileId, f.profileA);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("amendment proposal snapshots the CURRENT profile + goals (not the proposed delta)", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const { iepRevisions } = await import("@aivo/db");
    const { eq } = await import("drizzle-orm");

    const token = await tokenFor(f.caseManagerA, "TEACHER", f.tenantA);
    const proposed = {
      profile: { gradeLevel: "6", placement: "resource-room" },
      goals: { update: [{ id: f.goalA, goalText: "REVISED goal text" }] },
    };
    const res = await app.inject({
      method: "POST",
      url: `/api/iep/drafts/${f.profileA}/amendments`,
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      payload: { summary: "Bump grade level", proposedChanges: proposed },
    });
    assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}: ${res.body}`);

    const revs = await db.select().from(iepRevisions)
      .where(eq(iepRevisions.iepProfileId, f.profileA));
    assert.equal(revs.length, 1, "exactly one pre-amendment revision row should exist");
    const snap = revs[0].snapshot as any;

    // The legal "before" snapshot must hold the CURRENT persisted state so
    // reviewers can diff pre vs post per section.
    assert.ok(snap.profile, "snapshot must include the current profile");
    assert.equal(snap.profile.id, f.profileA);
    assert.equal(snap.profile.gradeLevel, "5",
      "snapshot.profile.gradeLevel must be the CURRENT value, not the proposed '6'");
    assert.equal(snap.profile.placement, "general-education",
      "snapshot.profile.placement must be the CURRENT value, not the proposed 'resource-room'");

    assert.ok(Array.isArray(snap.goals), "snapshot must include goals[]");
    assert.equal(snap.goals.length, 1);
    assert.equal(snap.goals[0].id, f.goalA);
    assert.equal(snap.goals[0].goalText, "Original goal text",
      "snapshot.goals[].goalText must be the CURRENT value, not the proposed 'REVISED goal text'");

    // The proposed delta is recorded alongside (for audit context) but
    // must NOT have replaced the current-state snapshot.
    assert.deepEqual(snap.affectedSections.sort(), ["goals", "profile"]);
    assert.deepEqual(snap.proposedDelta, proposed);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("timeline: bogus learner UUID returns 404, not 403, so attackers can't tell tenants apart", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const token = await tokenFor(f.parentA, "PARENT", f.tenantA);
    const res = await app.inject({
      method: "GET",
      url: `/api/iep/learners/00000000-0000-4000-8000-000000000000/timeline`,
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 404);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("timeline: malformed learner id returns 400 before any DB lookup", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const token = await tokenFor(f.parentA, "PARENT", f.tenantA);
    const res = await app.inject({
      method: "GET",
      url: `/api/iep/learners/not-a-uuid/timeline`,
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 400);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("timeline: missing/invalid bearer token is 401, not 403", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const noAuth = await app.inject({
      method: "GET",
      url: `/api/iep/learners/${f.learnerA}/timeline`,
    });
    assert.equal(noAuth.statusCode, 401);

    const badToken = await app.inject({
      method: "GET",
      url: `/api/iep/learners/${f.learnerA}/timeline`,
      headers: { Authorization: "Bearer not.a.valid.jwt" },
    });
    assert.equal(badToken.statusCode, 401);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("timeline: same-tenant DISTRICT_ADMIN can read the timeline", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const token = await tokenFor(f.districtAdminA, "DISTRICT_ADMIN", f.tenantA);
    const res = await getTimeline(app, f.learnerA, token);
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().iepProfileId, f.profileA);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("timeline: cross-tenant DISTRICT_ADMIN is forbidden", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    // District admin scoped to tenantB must NOT see tenantA learners just
    // because they have an admin role — district admin's bypass is
    // same-tenant-only.
    const token = await tokenFor(f.districtAdminA, "DISTRICT_ADMIN", f.tenantB);
    const res = await getTimeline(app, f.learnerA, token);
    assert.equal(res.statusCode, 403);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

// ───────── Visibility tier tests ─────────
// These exercise the per-role filtering of timeline items. They're
// security-critical: a regression here would either leak internal team
// notes to families/auditors, or hide reports from parents who need them.

async function seedNotesAndReports(db: any, f: Fixture) {
  const { iepProgressNotes, iepProgressReports } = await import("@aivo/db");
  await db.insert(iepProgressNotes).values([
    { iepProfileId: f.profileA, learnerId: f.learnerA, authorId: f.teacherA,
      body: "PARENT_NOTE",   visibility: "parent" },
    { iepProfileId: f.profileA, learnerId: f.learnerA, authorId: f.teacherA,
      body: "TEAM_NOTE",     visibility: "team" },
    { iepProfileId: f.profileA, learnerId: f.learnerA, authorId: f.caseManagerA,
      body: "INTERNAL_NOTE", visibility: "internal" },
  ] as any);
  await db.insert(iepProgressReports).values([
    { iepProfileId: f.profileA, learnerId: f.learnerA, period: "Q1",
      narrative: "DRAFT_REPORT", status: "draft", createdBy: f.caseManagerA },
    { iepProfileId: f.profileA, learnerId: f.learnerA, period: "Q2",
      narrative: "SENT_REPORT",  status: "sent",  createdBy: f.caseManagerA,
      sentBy: f.caseManagerA, sentAt: new Date() },
  ] as any);
}

test("timeline: parent sees only parent-visible notes and only sent reports", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    await seedNotesAndReports(db, f);
    const token = await tokenFor(f.parentA, "PARENT", f.tenantA);
    const res = await getTimeline(app, f.learnerA, token);
    assert.equal(res.statusCode, 200);
    const items = res.json().items as Array<{ type: string; payload: any }>;
    const noteBodies = items.filter(i => i.type === "note").map(i => i.payload.body);
    assert.deepEqual(noteBodies.sort(), ["PARENT_NOTE"],
      "parents must NEVER see team or internal notes");
    const reportNarratives = items.filter(i => i.type === "report").map(i => i.payload.narrative);
    assert.deepEqual(reportNarratives.sort(), ["SENT_REPORT"],
      "parents must NEVER see draft reports — only sent ones");
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("timeline: IEP team member sees the full feed including internal notes and draft reports", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    await seedNotesAndReports(db, f);
    const token = await tokenFor(f.teacherA, "TEACHER", f.tenantA);
    const res = await getTimeline(app, f.learnerA, token);
    assert.equal(res.statusCode, 200);
    const items = res.json().items as Array<{ type: string; payload: any }>;
    const noteBodies = items.filter(i => i.type === "note").map(i => i.payload.body);
    assert.deepEqual(noteBodies.sort(), ["INTERNAL_NOTE", "PARENT_NOTE", "TEAM_NOTE"]);
    const reportNarratives = items.filter(i => i.type === "report").map(i => i.payload.narrative);
    assert.deepEqual(reportNarratives.sort(), ["DRAFT_REPORT", "SENT_REPORT"]);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("timeline: district admin (no team membership) sees parent+team notes but never internal, and only sent reports", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    await seedNotesAndReports(db, f);
    const token = await tokenFor(f.districtAdminA, "DISTRICT_ADMIN", f.tenantA);
    const res = await getTimeline(app, f.learnerA, token);
    assert.equal(res.statusCode, 200);
    const items = res.json().items as Array<{ type: string; payload: any }>;
    const noteBodies = items.filter(i => i.type === "note").map(i => i.payload.body);
    assert.deepEqual(noteBodies.sort(), ["PARENT_NOTE", "TEAM_NOTE"],
      "district admin oversees but does NOT receive the team's internal-only notes");
    const reportNarratives = items.filter(i => i.type === "report").map(i => i.payload.narrative);
    assert.deepEqual(reportNarratives.sort(), ["SENT_REPORT"],
      "district admin sees finalised reports only — drafts are team-private");
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("timeline: PLATFORM_ADMIN sees the full feed even without team membership", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    await seedNotesAndReports(db, f);
    const token = await tokenFor(f.platformAdmin, "PLATFORM_ADMIN", f.tenantB);
    const res = await getTimeline(app, f.learnerA, token);
    assert.equal(res.statusCode, 200);
    const items = res.json().items as Array<{ type: string; payload: any }>;
    const noteBodies = items.filter(i => i.type === "note").map(i => i.payload.body);
    assert.deepEqual(noteBodies.sort(), ["INTERNAL_NOTE", "PARENT_NOTE", "TEAM_NOTE"]);
    const reportNarratives = items.filter(i => i.type === "report").map(i => i.payload.narrative);
    assert.deepEqual(reportNarratives.sort(), ["DRAFT_REPORT", "SENT_REPORT"]);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});
