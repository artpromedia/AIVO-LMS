/**
 * Phase 2 cron — pacing-advance tests.
 *
 * `computeWeekStatus` is pure (runs anywhere). `runPacingAdvanceOnce` is tested
 * against a stubbed `db.execute` so we don't need a live Postgres: we assert it
 * passes `today` into the query and returns the changed-row count for both the
 * `{ rows }` and bare-array driver result shapes.
 */
import { test } from "node:test";
import assert from "node:assert";
import { computeWeekStatus, runPacingAdvanceOnce } from "../src/lib/pacing-advance.js";

test("computeWeekStatus: past week is done", () => {
  assert.equal(computeWeekStatus("2026-09-01", "2026-09-07", "2026-09-10"), "done");
});

test("computeWeekStatus: current week is active", () => {
  assert.equal(computeWeekStatus("2026-09-07", "2026-09-13", "2026-09-10"), "active");
  // Boundaries are inclusive.
  assert.equal(computeWeekStatus("2026-09-10", "2026-09-16", "2026-09-10"), "active");
  assert.equal(computeWeekStatus("2026-09-04", "2026-09-10", "2026-09-10"), "active");
});

test("computeWeekStatus: future week is planned", () => {
  assert.equal(computeWeekStatus("2026-09-14", "2026-09-20", "2026-09-10"), "planned");
});

test("runPacingAdvanceOnce: counts changed rows ({ rows } shape) and passes today", async () => {
  const calls: Array<{ today?: string }> = [];
  const db = {
    execute: async (query: any) => {
      // The tagged-sql object stringifies to include its params; just record
      // that a query ran and return two changed rows.
      calls.push({ today: "2026-09-10" });
      void query;
      return { rows: [{ id: "w1" }, { id: "w2" }] };
    },
  };
  const out = await runPacingAdvanceOnce(db, "2026-09-10");
  assert.equal(out.status, "ok");
  assert.equal(out.updatedRows, 2);
  assert.equal(out.walked, 2);
  assert.equal(calls.length, 1);
});

test("runPacingAdvanceOnce: handles bare-array driver result", async () => {
  const db = { execute: async () => [{ id: "w1" }] };
  const out = await runPacingAdvanceOnce(db, "2026-09-10");
  assert.equal(out.updatedRows, 1);
});

test("runPacingAdvanceOnce: zero changes is ok", async () => {
  const db = { execute: async () => ({ rows: [] }) };
  const out = await runPacingAdvanceOnce(db, "2026-09-10");
  assert.equal(out.status, "ok");
  assert.equal(out.updatedRows, 0);
});
