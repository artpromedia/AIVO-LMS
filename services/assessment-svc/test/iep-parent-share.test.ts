/**
 * Phase D — secure parent share links for finalised IEPs (sprint task #13).
 *
 * Asserts the contracts that matter most for a feature parents will use to
 * give third parties access to a sensitive document:
 *   - Cannot issue against a non-finalised draft (409).
 *   - Only the parent or on-team case manager may issue / list / revoke.
 *   - Plaintext token is returned exactly once at creation; the database
 *     stores only the sha-256 hash.
 *   - Public redemption returns a parent-summary shape, bumps access
 *     counters, and refuses revoked / expired / unknown tokens with the
 *     same 404 (no enumeration).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { createDb } = await import("@aivo/db");
  const { registerIepParentShareRoutes } = await import("../src/routes/iep-parent-share.js");
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify({ logger: false });
  (app as any).db = db;
  await registerIepParentShareRoutes(app);
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
  caseManagerId: string;
  randomTeacherId: string;
  learnerId: string;
  draftProfileId: string;
  finalisedProfileId: string;
}

async function seed(db: any): Promise<Fixture> {
  const { tenants, users, learners, iepProfiles, iepTeamMembers } = await import("@aivo/db");
  const stamp = Date.now() + Math.floor(Math.random() * 1_000_000);
  const [t] = await db
    .insert(tenants)
    .values({
      name: `share-${stamp}`,
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
  const parentId = await mkUser("PARENT", "share-parent");
  const caseManagerId = await mkUser("TEACHER", "share-cm");
  const randomTeacherId = await mkUser("TEACHER", "share-other");
  const learnerUserId = await mkUser("LEARNER", "share-learner-user");
  const [learner] = await db
    .insert(learners)
    .values({
      tenantId: t.id,
      userId: learnerUserId,
      parentId,
      name: "Share Learner",
      gradeLevel: "4",
    } as any)
    .returning();
  const [draftProfile] = await db
    .insert(iepProfiles)
    .values({
      learnerId: learner.id,
      source: "authored",
      lifecycleState: "draft",
      authoredByUserId: caseManagerId,
      accommodations: [{ description: "Extended time" }],
      placement: "general-education",
    } as any)
    .returning();
  const [finalisedProfile] = await db
    .insert(iepProfiles)
    .values({
      learnerId: learner.id,
      source: "authored",
      lifecycleState: "finalised",
      authoredByUserId: caseManagerId,
      accommodations: [{ description: "Preferential seating" }],
      placement: "general-education",
      disabilityCategories: ["specific_learning_disability"],
    } as any)
    .returning();
  await db.insert(iepTeamMembers).values({
    iepProfileId: finalisedProfile.id,
    userId: caseManagerId,
    role: "case_manager",
    addedBy: caseManagerId,
  } as any);
  return {
    tenantId: t.id,
    parentId,
    caseManagerId,
    randomTeacherId,
    learnerId: learner.id,
    draftProfileId: draftProfile.id,
    finalisedProfileId: finalisedProfile.id,
  };
}

async function cleanup(db: any, f: Fixture) {
  const { eq, inArray } = await import("drizzle-orm");
  const { tenants, users, learners, iepProfiles, iepTeamMembers, iepParentShareLinks } =
    await import("@aivo/db");
  await db
    .delete(iepParentShareLinks)
    .where(inArray(iepParentShareLinks.iepProfileId, [f.draftProfileId, f.finalisedProfileId]));
  await db
    .delete(iepTeamMembers)
    .where(inArray(iepTeamMembers.iepProfileId, [f.draftProfileId, f.finalisedProfileId]));
  await db
    .delete(iepProfiles)
    .where(inArray(iepProfiles.id, [f.draftProfileId, f.finalisedProfileId]));
  await db.delete(learners).where(eq(learners.id, f.learnerId));
  await db.delete(users).where(eq(users.tenantId, f.tenantId));
  await db.delete(tenants).where(eq(tenants.id, f.tenantId));
}

async function tokenFor(sub: string, role: string, tenantId: string): Promise<string> {
  const { signJWT } = await import("@aivo/security");
  return signJWT({ sub, role, tenantId }, "5m");
}

test("share-links: parent can issue + redeem against a finalised IEP", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const parentToken = await tokenFor(f.parentId, "PARENT", f.tenantId);
    const issued = await app.inject({
      method: "POST",
      url: `/api/iep/drafts/${f.finalisedProfileId}/share-links`,
      headers: { Authorization: `Bearer ${parentToken}`, "Content-Type": "application/json" },
      payload: { label: "Mrs. Reyes (tutor)", ttlDays: 7 },
    });
    assert.equal(issued.statusCode, 201, issued.body);
    const issuedBody = issued.json();
    assert.ok(issuedBody.token, "plaintext token returned at creation time");
    assert.equal(issuedBody.label, "Mrs. Reyes (tutor)");

    // Plaintext must not be persisted — only the sha-256 hash.
    const { iepParentShareLinks } = await import("@aivo/db");
    const { eq } = await import("drizzle-orm");
    const [persisted] = await db
      .select()
      .from(iepParentShareLinks)
      .where(eq(iepParentShareLinks.id, issuedBody.id));
    const expectedHash = crypto.createHash("sha256").update(issuedBody.token).digest("hex");
    assert.equal(
      persisted.tokenHash,
      expectedHash,
      "stored token_hash must equal sha256(plaintext)",
    );
    assert.notEqual(
      persisted.tokenHash,
      issuedBody.token,
      "the plaintext token MUST NOT land in the DB column",
    );

    // Redeem the token without auth.
    const redeem = await app.inject({
      method: "GET",
      url: `/api/iep/share/${issuedBody.token}`,
    });
    assert.equal(redeem.statusCode, 200, redeem.body);
    const view = redeem.json();
    assert.equal(view.iep.lifecycleState, "finalised");
    assert.equal(view.learner.id, f.learnerId);
    assert.deepEqual(view.iep.disabilityCategories, ["specific_learning_disability"]);
    assert.equal(view.shareLink.label, "Mrs. Reyes (tutor)");

    // Access counter should bump (best-effort, allow a brief delay).
    await new Promise((r) => setTimeout(r, 80));
    const [afterAccess] = await db
      .select()
      .from(iepParentShareLinks)
      .where(eq(iepParentShareLinks.id, issuedBody.id));
    assert.equal(afterAccess.accessCount, 1, "access count must bump on redemption");
    assert.ok(afterAccess.lastAccessedAt, "last_accessed_at must be set on redemption");
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("share-links: cannot issue against a non-finalised draft (409)", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const parentToken = await tokenFor(f.parentId, "PARENT", f.tenantId);
    const issued = await app.inject({
      method: "POST",
      url: `/api/iep/drafts/${f.draftProfileId}/share-links`,
      headers: { Authorization: `Bearer ${parentToken}`, "Content-Type": "application/json" },
      payload: { label: "tutor" },
    });
    assert.equal(issued.statusCode, 409, "share links may only be issued on finalised IEPs");
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test(
  "share-links: a random teacher (not parent, not case manager) cannot issue (403)",
  { skip: SKIP },
  async () => {
    const { app, db } = await bootstrap();
    const f = await seed(db);
    try {
      const otherToken = await tokenFor(f.randomTeacherId, "TEACHER", f.tenantId);
      const res = await app.inject({
        method: "POST",
        url: `/api/iep/drafts/${f.finalisedProfileId}/share-links`,
        headers: { Authorization: `Bearer ${otherToken}`, "Content-Type": "application/json" },
        payload: { label: "tutor" },
      });
      assert.equal(res.statusCode, 403);
    } finally {
      await cleanup(db, f);
      await teardown(app, db);
    }
  },
);

test("share-links: revoked tokens return 404 (no enumeration)", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const parentToken = await tokenFor(f.parentId, "PARENT", f.tenantId);
    const issued = await app.inject({
      method: "POST",
      url: `/api/iep/drafts/${f.finalisedProfileId}/share-links`,
      headers: { Authorization: `Bearer ${parentToken}`, "Content-Type": "application/json" },
      payload: {},
    });
    assert.equal(issued.statusCode, 201);
    const { token, id: linkId } = issued.json();
    const revoke = await app.inject({
      method: "POST",
      url: `/api/iep/drafts/${f.finalisedProfileId}/share-links/${linkId}/revoke`,
      headers: { Authorization: `Bearer ${parentToken}` },
    });
    assert.equal(revoke.statusCode, 200);
    const redeem = await app.inject({
      method: "GET",
      url: `/api/iep/share/${token}`,
    });
    assert.equal(
      redeem.statusCode,
      404,
      "revoked tokens must return the same 404 shape as unknown tokens",
    );
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});

test("share-links: unknown token redemption is 404", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const f = await seed(db);
  try {
    const res = await app.inject({
      method: "GET",
      url: "/api/iep/share/" + crypto.randomBytes(32).toString("base64url"),
    });
    assert.equal(res.statusCode, 404);
  } finally {
    await cleanup(db, f);
    await teardown(app, db);
  }
});
