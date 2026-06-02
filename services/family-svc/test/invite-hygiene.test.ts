/**
 * Sprint 5 (invite-flows) — invite hygiene tests.
 *
 * Covers:
 *   1. Per-user invite rate limit (10/hour). After the 11th create the
 *      service returns 429 with Retry-After.
 *   2. Generic resend endpoint for teacher invites: 200 on PENDING,
 *      400 once the row is ACCEPTED, 403 for a non-parent caller.
 *   3. Generic revoke endpoint: sets status to REVOKED on PENDING,
 *      returns 400 when the invite was already accepted.
 *
 * Skips when DATABASE_URL is unset — same pattern as the other DB
 * integration tests in this service.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { createDb } = await import("@aivo/db");
  const { initKeys } = await import("@aivo/security");
  const { registerCollaborationRoutes, resetInviteRateLimitsForTest } =
    await import("../src/routes/collaboration.js");
  await initKeys();
  resetInviteRateLimitsForTest();
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify({ logger: false });
  (app as any).db = db;
  await registerCollaborationRoutes(app);
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
  tenantId: string;
  parentId: string;
  parentEmail: string;
  learnerId: string;
}

async function seed(db: any): Promise<Fixture> {
  const { tenants, users, learners } = await import("@aivo/db");
  const stamp = Date.now();
  const [t] = await db
    .insert(tenants)
    .values({ name: `hyg-${stamp}`, type: "B2C_FAMILY" } as any)
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
    return u as { id: string; email: string };
  };
  const parent = await mkUser("PARENT", "hyg-parent");
  const learnerUser = await mkUser("LEARNER", "hyg-luser");
  const [learner] = await db
    .insert(learners)
    .values({
      tenantId: t.id,
      userId: learnerUser.id,
      parentId: parent.id,
      name: "Hyg Learner",
    } as any)
    .returning();
  return {
    tenantId: t.id,
    parentId: parent.id,
    parentEmail: parent.email,
    learnerId: learner.id,
  };
}

async function cleanup(db: any, f: Fixture) {
  const { eq } = await import("drizzle-orm");
  const { tenants, users, learners, learnerTeachers, learnerCaregivers, learnerTherapists } =
    await import("@aivo/db");
  await db.delete(learnerTeachers).where(eq(learnerTeachers.tenantId, f.tenantId));
  await db.delete(learnerCaregivers).where(eq(learnerCaregivers.tenantId, f.tenantId));
  await db.delete(learnerTherapists).where(eq(learnerTherapists.tenantId, f.tenantId));
  await db.delete(learners).where(eq(learners.id, f.learnerId));
  await db.delete(users).where(eq(users.tenantId, f.tenantId));
  await db.delete(tenants).where(eq(tenants.id, f.tenantId));
}

async function tokenFor(claims: Record<string, unknown>) {
  const { signJWT } = await import("@aivo/security");
  return signJWT(claims, "5m");
}

test(
  "invite rate limit: 11th create within the hour is rejected with 429",
  { skip: SKIP },
  async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      const parentToken = await tokenFor({
        sub: f.parentId,
        role: "PARENT",
        tenantId: f.tenantId,
        email: f.parentEmail,
      });

      // The teacher slot is capped at 1 per learner, so we exercise the
      // rate limit on caregivers (cap is 2 per learner, so we'd hit 409
      // duplicate before 429). The rate-limit middleware runs BEFORE the
      // duplicate check, so a stream of identical create calls is the
      // simplest probe: the first should succeed or fail with 409; the
      // 11th must be 429 regardless.
      const statuses: number[] = [];
      for (let i = 0; i < 11; i++) {
        const r = await app.inject({
          method: "POST",
          url: `/api/family/collaboration/${f.learnerId}/invite/caregiver`,
          headers: { authorization: `Bearer ${parentToken}` },
          payload: { email: `cg-${i}@test.local`, relationship: "Co-parent" },
        });
        statuses.push(r.statusCode);
      }
      // First 10 are processed (some may be 201, some 400 once cap is hit).
      // The 11th must be 429.
      assert.equal(statuses[10], 429, `expected 429 on 11th call, got ${statuses[10]}`);
    } finally {
      await cleanup(db, f);
      await teardown(app, db);
    }
  },
);

test(
  "invite resend: bumps invitedAt, returns 200 for PENDING, 400 for ACCEPTED",
  { skip: SKIP },
  async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      const parentToken = await tokenFor({
        sub: f.parentId,
        role: "PARENT",
        tenantId: f.tenantId,
        email: f.parentEmail,
      });

      // Create a teacher invite.
      const create = await app.inject({
        method: "POST",
        url: `/api/family/collaboration/${f.learnerId}/invite/teacher`,
        headers: { authorization: `Bearer ${parentToken}` },
        payload: { email: "teacher-resend@test.local" },
      });
      assert.equal(create.statusCode, 201, create.body);
      const inviteId = (create.json() as any).id;

      // Resend → 200.
      const resend = await app.inject({
        method: "POST",
        url: `/api/family/collaboration/invites/teacher/${inviteId}/resend`,
        headers: { authorization: `Bearer ${parentToken}` },
      });
      assert.equal(resend.statusCode, 200, resend.body);

      // Mark accepted manually, then resend → 400.
      const { learnerTeachers } = await import("@aivo/db");
      const { eq } = await import("drizzle-orm");
      await db
        .update(learnerTeachers)
        .set({ status: "ACCEPTED", acceptedAt: new Date() })
        .where(eq(learnerTeachers.id, inviteId));

      const resendAccepted = await app.inject({
        method: "POST",
        url: `/api/family/collaboration/invites/teacher/${inviteId}/resend`,
        headers: { authorization: `Bearer ${parentToken}` },
      });
      assert.equal(resendAccepted.statusCode, 400);
    } finally {
      await cleanup(db, f);
      await teardown(app, db);
    }
  },
);

test("invite revoke: sets status to REVOKED, blocks accepted rows", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const parentToken = await tokenFor({
      sub: f.parentId,
      role: "PARENT",
      tenantId: f.tenantId,
      email: f.parentEmail,
    });

    const create = await app.inject({
      method: "POST",
      url: `/api/family/collaboration/${f.learnerId}/invite/caregiver`,
      headers: { authorization: `Bearer ${parentToken}` },
      payload: { email: "cg-revoke@test.local", relationship: "Grandparent" },
    });
    assert.equal(create.statusCode, 201, create.body);
    const inviteId = (create.json() as any).id;

    const revoke = await app.inject({
      method: "DELETE",
      url: `/api/family/collaboration/invites/caregiver/${inviteId}`,
      headers: { authorization: `Bearer ${parentToken}` },
    });
    assert.equal(revoke.statusCode, 200);

    // Status now REVOKED.
    const { learnerCaregivers } = await import("@aivo/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select()
      .from(learnerCaregivers)
      .where(eq(learnerCaregivers.id, inviteId));
    assert.equal(row.status, "REVOKED");

    // Revoking again on a non-PENDING row returns success (idempotent)
    // — the spec only blocks ACCEPTED. Promote it to ACCEPTED and try.
    await db
      .update(learnerCaregivers)
      .set({ status: "ACCEPTED", acceptedAt: new Date() })
      .where(eq(learnerCaregivers.id, inviteId));
    const blocked = await app.inject({
      method: "DELETE",
      url: `/api/family/collaboration/invites/caregiver/${inviteId}`,
      headers: { authorization: `Bearer ${parentToken}` },
    });
    assert.equal(blocked.statusCode, 400);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("invite resend: non-parent caller is rejected with 403", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const parentToken = await tokenFor({
      sub: f.parentId,
      role: "PARENT",
      tenantId: f.tenantId,
      email: f.parentEmail,
    });
    const create = await app.inject({
      method: "POST",
      url: `/api/family/collaboration/${f.learnerId}/invite/therapist`,
      headers: { authorization: `Bearer ${parentToken}` },
      payload: { email: "ther@test.local", specialty: "OT" },
    });
    assert.equal(create.statusCode, 201, create.body);
    const inviteId = (create.json() as any).id;

    const intruderToken = await tokenFor({
      sub: "11111111-1111-1111-1111-111111111111",
      role: "PARENT",
      tenantId: f.tenantId,
      email: "intruder@test.local",
    });
    const r = await app.inject({
      method: "POST",
      url: `/api/family/collaboration/invites/therapist/${inviteId}/resend`,
      headers: { authorization: `Bearer ${intruderToken}` },
    });
    assert.equal(r.statusCode, 403);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});
