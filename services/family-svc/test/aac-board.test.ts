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

test("buildSymbolBoard anchors a board with core vocabulary", { skip: SKIP }, async () => {
  const { db, learners, aacVocabulary, buildSymbolBoard } = await ctx();
  const { eq } = await import("drizzle-orm");
  const [learner] = await db.insert(learners).values({}).returning({ id: learners.id });
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
    await db.delete(learners).where(eq(learners.id, learner.id));
    try {
      await (db as any).$client?.end?.({ timeout: 2 });
    } catch {
      /* ignore */
    }
  }
});

test("buildSymbolBoard includes fringe words layered on core", { skip: SKIP }, async () => {
  const { db, learners, aacVocabulary, buildSymbolBoard } = await ctx();
  const { eq } = await import("drizzle-orm");
  const [learner] = await db.insert(learners).values({}).returning({ id: learners.id });
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
    await db.delete(learners).where(eq(learners.id, learner.id));
    try {
      await (db as any).$client?.end?.({ timeout: 2 });
    } catch {
      /* ignore */
    }
  }
});
