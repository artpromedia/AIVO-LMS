/**
 * Sprint task #10: parent + district-admin notifications when an
 * evaluation status changes. The submit and decision endpoints fan out
 * notifications via comms-svc, gated by the submit_notified_at /
 * decision_notified_at idempotency latches on iep_evaluations.
 *
 * The tests assert two contracts:
 *   1. The first submit / decision call dispatches exactly one email to
 *      the parent (and the right admin emails for submit), and exactly
 *      one in-app notification.
 *   2. Concurrent retries of the same call must NOT duplicate the
 *      dispatch — the latch column is set under WHERE … IS NULL, so the
 *      database elects the single winner.
 *
 * The outbound fetch to comms-svc is stubbed, and we count calls by
 * template name so the assertions are precise.
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
  tenantId: string;
  parentId: string;
  teacherId: string;
  districtAdmin1Id: string;
  districtAdmin2Id: string;
  otherTenantAdminId: string;
  learnerId: string;
  teacherLinkId: string;
}

async function seed(db: any): Promise<Fixture> {
  const { tenants, users, learners, learnerTeachers } = await import("@aivo/db");
  const stamp = Date.now() + Math.floor(Math.random() * 1_000_000);
  const [t] = await db.insert(tenants).values({
    name: `notify-eval-${stamp}`, type: "B2B_DISTRICT",
  } as any).returning();
  const [tOther] = await db.insert(tenants).values({
    name: `notify-eval-other-${stamp}`, type: "B2B_DISTRICT",
  } as any).returning();
  const mkUser = async (tenantId: string, role: string, name: string) => {
    const [u] = await db.insert(users).values({
      tenantId, name, role,
      email: `${name}-${stamp}@test.local`,
    } as any).returning();
    return u.id as string;
  };
  const parentId = await mkUser(t.id, "PARENT", "notify-eval-parent");
  const teacherId = await mkUser(t.id, "TEACHER", "notify-eval-teacher");
  const districtAdmin1Id = await mkUser(t.id, "DISTRICT_ADMIN", "notify-eval-da1");
  const districtAdmin2Id = await mkUser(t.id, "DISTRICT_ADMIN", "notify-eval-da2");
  const otherTenantAdminId = await mkUser(tOther.id, "DISTRICT_ADMIN", "notify-eval-da-other");
  const learnerUserId = await mkUser(t.id, "LEARNER", "notify-eval-luser");
  const [learner] = await db.insert(learners).values({
    tenantId: t.id, userId: learnerUserId, parentId,
    name: "Notify Eval Learner",
  } as any).returning();
  const [link] = await db.insert(learnerTeachers).values({
    tenantId: t.id, learnerId: learner.id,
    teacherEmail: `notify-eval-teacher-${stamp}@test.local`,
    teacherUserId: teacherId, invitedBy: parentId,
    status: "ACCEPTED", acceptedAt: new Date(),
  } as any).returning();
  return {
    tenantId: t.id, parentId, teacherId,
    districtAdmin1Id, districtAdmin2Id, otherTenantAdminId,
    learnerId: learner.id, teacherLinkId: link.id,
  };
}

async function cleanup(db: any, f: Fixture) {
  const { eq, inArray } = await import("drizzle-orm");
  const { tenants, users, learners, learnerTeachers, iepEvaluations }
    = await import("@aivo/db");
  await db.delete(iepEvaluations).where(eq(iepEvaluations.learnerId, f.learnerId));
  await db.delete(learnerTeachers).where(eq(learnerTeachers.id, f.teacherLinkId));
  await db.delete(learners).where(eq(learners.id, f.learnerId));
  await db.delete(users).where(inArray(users.id, [
    f.parentId, f.teacherId, f.districtAdmin1Id, f.districtAdmin2Id, f.otherTenantAdminId,
  ]));
  await db.delete(users).where(eq(users.tenantId, f.tenantId));
  await db.delete(tenants).where(eq(tenants.id, f.tenantId));
}

async function tokenFor(sub: string, role: string, tenantId: string): Promise<string> {
  const { signJWT } = await import("@aivo/security");
  return signJWT({ sub, role, tenantId }, "5m");
}

interface FetchCall { url: string; body: any }

function installFetchSpy(): { calls: FetchCall[]; restore: () => void } {
  const calls: FetchCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: any, init?: any) => {
    let parsed: any = null;
    try { parsed = init?.body ? JSON.parse(init.body) : null; } catch { /* noop */ }
    calls.push({ url: String(url), body: parsed });
    return new Response(JSON.stringify({ status: "queued" }),
      { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

async function settle(): Promise<void> {
  // Fire-and-forget dispatches use `void (async () => { ... })()` — yield
  // a few microtasks so the comms-svc fetch and the latch UPDATE both
  // complete before we assert.
  await new Promise((r) => setTimeout(r, 100));
}

test("submit dispatches exactly one parent + each district admin email + one in-app, and is idempotent under retry",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    const spy = installFetchSpy();
    try {
      const { iepEvaluations } = await import("@aivo/db");
      const [evalRow] = await db.insert(iepEvaluations).values({
        learnerId: f.learnerId, tenantId: f.tenantId,
        initiatedByUserId: f.teacherId, status: "draft",
      } as any).returning();
      const token = await tokenFor(f.teacherId, "TEACHER", f.tenantId);

      // Fire 5 concurrent submits — only one wins the status transition,
      // and only that winner may dispatch notifications. The other 4
      // return 409 (status guard) and must not enqueue anything.
      const responses = await Promise.all(
        Array.from({ length: 5 }, () => app.inject({
          method: "POST",
          url: `/api/iep/evaluations/${evalRow.id}/submit`,
          headers: { Authorization: `Bearer ${token}` },
        })),
      );
      const winners = responses.filter((r: any) => r.statusCode === 200);
      assert.equal(winners.length, 1, "exactly one submit must succeed under concurrent retry");
      const losers = responses.filter((r: any) => r.statusCode === 409);
      assert.equal(losers.length, 4, "the other four retries must 409");

      await settle();

      const parentEmailCalls = spy.calls.filter((c) => c.url.includes("/iep-notify")
        && c.body?.template === "evaluation_submitted");
      const adminEmailCalls = spy.calls.filter((c) => c.url.includes("/iep-notify")
        && c.body?.template === "evaluation_submitted_admin");
      const inAppCalls = spy.calls.filter((c) => c.url.includes("/in-app-notify")
        && c.body?.template === "evaluation_submitted");
      assert.equal(parentEmailCalls.length, 1,
        "exactly one parent submit-notification email must be dispatched");
      assert.equal(inAppCalls.length, 1,
        "exactly one parent in-app submit notification must be dispatched");
      // Two district admins in the tenant; one in another tenant must NOT
      // be reached.
      assert.equal(adminEmailCalls.length, 2,
        `both same-tenant DISTRICT_ADMINs (and only them) must receive the admin email — got ${adminEmailCalls.length}`);
      const adminTos = adminEmailCalls.map((c) => c.body.to).sort();
      // Neither admin email recipient should be the cross-tenant admin.
      const otherAdminEmail = (await db.select({ email: (await import("@aivo/db")).users.email })
        .from((await import("@aivo/db")).users)
        .where((await import("drizzle-orm")).eq((await import("@aivo/db")).users.id, f.otherTenantAdminId)))[0]?.email;
      assert.ok(!adminTos.includes(otherAdminEmail),
        "cross-tenant DISTRICT_ADMIN must NOT receive the admin email");

      // Now retry the submit — the latch is set, status is already
      // "submitted", so the retry returns 409 and dispatches nothing
      // additional.
      const retry = await app.inject({
        method: "POST",
        url: `/api/iep/evaluations/${evalRow.id}/submit`,
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(retry.statusCode, 409);
      await settle();
      const afterRetryParent = spy.calls.filter((c) => c.url.includes("/iep-notify")
        && c.body?.template === "evaluation_submitted").length;
      assert.equal(afterRetryParent, 1,
        "no further parent emails on retry — submit_notified_at gates re-dispatch");
    } finally {
      spy.restore();
      await cleanup(db, f);
      await teardown(app, db);
    }
  });

test("decision dispatches exactly one parent email + one in-app notification, and is idempotent",
  { skip: SKIP }, async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    const spy = installFetchSpy();
    try {
      const { iepEvaluations } = await import("@aivo/db");
      const [evalRow] = await db.insert(iepEvaluations).values({
        learnerId: f.learnerId, tenantId: f.tenantId,
        initiatedByUserId: f.teacherId,
        status: "submitted", submittedAt: new Date(),
      } as any).returning();
      const token = await tokenFor(f.teacherId, "TEACHER", f.tenantId);

      // Fire 5 concurrent decision calls.
      const responses = await Promise.all(
        Array.from({ length: 5 }, () => app.inject({
          method: "POST",
          url: `/api/iep/evaluations/${evalRow.id}/decision`,
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          payload: {
            decision: "eligible",
            categories: ["specific_learning_disability"],
            rationale: "rationale for the decision",
          },
        })),
      );
      const winners = responses.filter((r: any) => r.statusCode === 200);
      assert.equal(winners.length, 1, "exactly one decision call must succeed");

      await settle();

      const parentDecidedEmails = spy.calls.filter((c) => c.url.includes("/iep-notify")
        && c.body?.template === "evaluation_decided");
      const parentDecidedInApp = spy.calls.filter((c) => c.url.includes("/in-app-notify")
        && c.body?.template === "evaluation_decided");
      assert.equal(parentDecidedEmails.length, 1,
        "exactly one decision email must reach the parent");
      assert.equal(parentDecidedInApp.length, 1,
        "exactly one decision in-app notification must reach the parent");

      // The decision email body must include the actual decision string —
      // otherwise the parent inbox shows a meaningless ping.
      assert.equal(parentDecidedEmails[0].body.data.decision, "eligible");
    } finally {
      spy.restore();
      await cleanup(db, f);
      await teardown(app, db);
    }
  });
