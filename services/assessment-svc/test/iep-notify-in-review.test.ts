/**
 * Regression test for POST /api/iep/drafts/:id/notify-in-review.
 *
 * Earlier the handler did a stale read of `inReviewNotifiedAt`, then issued
 * an unconditional UPDATE. Two concurrent requests could both pass the read
 * check (seeing NULL), both run the UPDATE, and both dispatch the parent
 * notification — resulting in duplicate parent emails / in-app entries.
 *
 * The fix gates the UPDATE on `in_review_notified_at IS NULL` so the database
 * itself elects the single winner. This test fires N concurrent calls and
 * asserts that exactly one returns `sent: true` and the comms-svc is invoked
 * exactly once.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { provisionTestDatabase } = await import("@aivo/db");
  const { registerIepCollabRoutes } = await import("../src/routes/iep-collab.js");
  const { db, teardown: closeDb } = await provisionTestDatabase();
  const app = Fastify({ logger: false });
  (app as any).db = db;
  await registerIepCollabRoutes(app);
  await app.ready();
  return { app, db, closeDb };
}

async function teardown(app: any, closeDb: () => Promise<void>) {
  await app.close();
  await closeDb();
}

interface Fixture {
  tenantId: string;
  parentId: string;
  caseManagerId: string;
  learnerId: string;
  profileId: string;
}

async function seed(db: any): Promise<Fixture> {
  const { tenants, users, learners, iepProfiles, iepTeamMembers }
    = await import("@aivo/db");
  const stamp = Date.now() + Math.floor(Math.random() * 1_000_000);
  const [t] = await db.insert(tenants).values({
    name: `notify-test-${stamp}`, type: "B2B_DISTRICT",
  } as any).returning();
  const mkUser = async (role: string, name: string) => {
    const [u] = await db.insert(users).values({
      tenantId: t.id, name, role,
      email: `${name}-${stamp}@test.local`,
    } as any).returning();
    return u.id as string;
  };
  const parentId = await mkUser("PARENT", "notify-parent");
  const caseManagerId = await mkUser("TEACHER", "notify-cm");
  const learnerUser = await mkUser("LEARNER", "notify-learner-user");
  const [learner] = await db.insert(learners).values({
    tenantId: t.id, userId: learnerUser, parentId,
    name: "Notify Test Learner",
  } as any).returning();
  const [profile] = await db.insert(iepProfiles).values({
    learnerId: learner.id,
    gradeLevel: "5",
    placement: "general-education",
    accommodations: [],
    source: "authored",
    lifecycleState: "in_review",
    authoredByUserId: caseManagerId,
  } as any).returning();
  await db.insert(iepTeamMembers).values([
    { iepProfileId: profile.id, userId: caseManagerId, role: "case_manager", addedBy: caseManagerId },
  ] as any);
  return {
    tenantId: t.id, parentId, caseManagerId,
    learnerId: learner.id, profileId: profile.id,
  };
}

async function cleanup(db: any, f: Fixture) {
  const { eq, inArray } = await import("drizzle-orm");
  const { tenants, users, learners, iepProfiles, iepTeamMembers } = await import("@aivo/db");
  await db.delete(iepTeamMembers).where(eq(iepTeamMembers.iepProfileId, f.profileId));
  await db.delete(iepProfiles).where(eq(iepProfiles.id, f.profileId));
  await db.delete(learners).where(eq(learners.id, f.learnerId));
  await db.delete(users).where(inArray(users.id, [f.parentId, f.caseManagerId]));
  await db.delete(users).where(eq(users.tenantId, f.tenantId));
  await db.delete(tenants).where(eq(tenants.id, f.tenantId));
}

async function tokenFor(sub: string, role: string, tenantId: string): Promise<string> {
  const { signJWT } = await import("@aivo/security");
  return signJWT({ sub, role, tenantId }, "5m");
}

test("notify-in-review: concurrent calls dispatch parent notification exactly once",
  { skip: SKIP }, async () => {
    const { app, db, closeDb } = await bootstrap();
    const f = await seed(db);
    // Stub global fetch (used by bestEffortSendEmail) to count outbound calls
    // to comms-svc/internal/iep-notify so we can assert dedup at the wire.
    const originalFetch = globalThis.fetch;
    let commsCalls = 0;
    globalThis.fetch = (async (url: any, _init?: any) => {
      const u = String(url);
      if (u.includes("/api/comms/internal/iep-notify")) {
        commsCalls += 1;
      }
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    try {
      const token = await tokenFor(f.caseManagerId, "TEACHER", f.tenantId);
      const N = 8;
      const responses = await Promise.all(
        Array.from({ length: N }, () => app.inject({
          method: "POST",
          url: `/api/iep/drafts/${f.profileId}/notify-in-review`,
          headers: { Authorization: `Bearer ${token}` },
        })),
      );
      const sent = responses.filter((r: any) => {
        assert.equal(r.statusCode, 200, `unexpected status: ${r.statusCode} ${r.body}`);
        return r.json().sent === true;
      });
      assert.equal(sent.length, 1,
        `expected exactly one of ${N} concurrent notify-in-review calls to send the parent email, got ${sent.length}`);
      // Allow the in-flight best-effort fetch microtasks to settle.
      await new Promise((r) => setTimeout(r, 50));
      assert.equal(commsCalls, 1,
        `expected exactly one outbound comms-svc dispatch, got ${commsCalls}`);
    } finally {
      globalThis.fetch = originalFetch;
      await cleanup(db, f);
      await teardown(app, closeDb);
    }
  });
