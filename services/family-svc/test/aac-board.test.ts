/**
 * Sprint 3 (production readiness) — AAC symbol-board construction.
 *
 * Verifies buildSymbolBoard against a real Postgres: the board is anchored by
 * curated core vocabulary (never empty), is idempotent across calls, includes
 * fringe words, and resolves symbol image URLs. Skips without DATABASE_URL.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;

async function ctx() {
  const { createDb, learners, aacVocabulary } = await import("@aivo/db");
  const db = createDb(process.env.DATABASE_URL!);
  const { buildSymbolBoard, ensureCoreVocabulary } = await import("../src/lib/aac-board.js");
  return { db, learners, aacVocabulary, buildSymbolBoard, ensureCoreVocabulary };
}

/**
 * The `learners` table has NOT NULL foreign keys to `tenants` / `users`
 * (tenantId, userId, parentId) plus a NOT NULL `name`, so `values({})` is
 * not a valid bootstrap — Postgres rejects it with a tenant_id null
 * violation. Seed the minimum graph (tenant + parent user + learner user)
 * so the AAC board logic can attach to a real learner row.
 */
async function seedLearner(db: any) {
  const { tenants, users, learners } = await import("@aivo/db");
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const [t] = await db
    .insert(tenants)
    .values({ name: `aac-${stamp}`, type: "B2C_FAMILY" } as any)
    .returning();
  const [parent] = await db
    .insert(users)
    .values({
      tenantId: t.id,
      name: `aac-parent-${stamp}`,
      email: `aac-parent-${stamp}@test.local`,
      role: "PARENT",
    } as any)
    .returning();
  const [luser] = await db
    .insert(users)
    .values({
      tenantId: t.id,
      name: `aac-learner-${stamp}`,
      email: `aac-learner-${stamp}@test.local`,
      role: "LEARNER",
    } as any)
    .returning();
  const [learner] = await db
    .insert(learners)
    .values({
      tenantId: t.id,
      userId: luser.id,
      parentId: parent.id,
      name: `AAC Test Learner ${stamp}`,
    } as any)
    .returning();
  return { learner, tenant: t, parent, luser };
}

async function cleanupLearner(
  db: any,
  ids: { learner: { id: string }; tenant: { id: string }; parent: { id: string }; luser: { id: string } },
) {
  const { learners, users, tenants } = await import("@aivo/db");
  const { eq } = await import("drizzle-orm");
  try {
    await db.delete(learners).where(eq(learners.id, ids.learner.id));
  } catch {
    /* ignore */
  }
  try {
    await db.delete(users).where(eq(users.id, ids.luser.id));
    await db.delete(users).where(eq(users.id, ids.parent.id));
  } catch {
    /* ignore */
  }
  try {
    await db.delete(tenants).where(eq(tenants.id, ids.tenant.id));
  } catch {
    /* ignore */
  }
}

test("buildSymbolBoard anchors a board with core vocabulary", { skip: SKIP }, async () => {
  const { db, learners, aacVocabulary, buildSymbolBoard } = await ctx();
  const { eq } = await import("drizzle-orm");
  const ids = await seedLearner(db);
  const learner = ids.learner;
  try {
    const board = await buildSymbolBoard(db, learner.id, "en");
    assert.ok(board.items.length >= 16, "core board has at least 16 words");
    assert.equal(board.locale, "en");
    assert.ok(board.grid.rows > 0 && board.grid.cols > 0);
    const want = board.items.find((i) => i.label === "want");
    assert.ok(want, "core word 'want' present");
    assert.match(want!.imageUrl, /want\.svg$/);

    // Idempotent: a second build does not duplicate the core rows.
    const board2 = await buildSymbolBoard(db, learner.id, "en");
    assert.equal(board2.items.length, board.items.length);
    const rows = await db
      .select()
      .from(aacVocabulary)
      .where(eq(aacVocabulary.learnerId, learner.id));
    assert.equal(rows.length, board.items.length);
  } finally {
    await cleanupLearner(db, ids);
    try {
      await (db as any).$client?.end?.({ timeout: 2 });
    } catch {
      /* ignore */
    }
  }
});

test("buildSymbolBoard includes fringe words layered on core", { skip: SKIP }, async () => {
  const { db, learners, aacVocabulary, buildSymbolBoard } = await ctx();
  const ids = await seedLearner(db);
  const learner = ids.learner;
  try {
    // Seed core first, then add a fringe word.
    await buildSymbolBoard(db, learner.id, "en");
    await db.insert(aacVocabulary).values({
      learnerId: learner.id,
      locale: "en",
      label: "dinosaur",
      symbolKey: "dinosaur",
      kind: "fringe",
      gridRow: 4,
      gridCol: 0,
    });
    const board = await buildSymbolBoard(db, learner.id, "en");
    const fringe = board.items.find((i) => i.label === "dinosaur");
    assert.ok(fringe, "fringe word present on the board");
    assert.ok(board.grid.rows >= 5, "grid grew to fit the fringe row");
  } finally {
    await cleanupLearner(db, ids);
    try {
      await (db as any).$client?.end?.({ timeout: 2 });
    } catch {
      /* ignore */
    }
  }
});
