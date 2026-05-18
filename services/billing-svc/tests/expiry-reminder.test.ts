/**
 * Sprint 7 — billing expiry-reminder service tests. (Tasks #54, #63, #65)
 *
 * Confirms that the service no longer crashes with `ReferenceError: sql is not
 * defined` when executed against a stub DB. The unit suite passes a fake `db`
 * with `execute` so the import-bug regression — which only ever fires the SQL
 * — is caught here.
 */
import { test } from "node:test";
import assert from "node:assert";
import { runDailyExpiryBatch } from "../src/lib/expiryReminderService.js";

function makeStubDb(rows: any[]) {
  const queries: string[] = [];
  return {
    queries,
    execute(q: any) {
      queries.push(
        q?.queryChunks?.map((c: any) => (typeof c === "string" ? c : "?")).join("") ?? "",
      );
      // The first query is the SELECT, subsequent queries are the INSERT and DELETE.
      // Return rows for the SELECT, empty for everything else.
      if (queries.length === 1) return Promise.resolve({ rows });
      return Promise.resolve({ rows: [] });
    },
  };
}

test("runs without ReferenceError when there are no due rows", async () => {
  const db = makeStubDb([]);
  const result = await runDailyExpiryBatch({
    db,
    sendReminder: async () => ({ ok: true }),
  });
  assert.equal(result.status, "ok");
  assert.equal(result.sent, 0);
  assert.equal(result.failed, 0);
});

test("counts sent + failed per row", async () => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const db = makeStubDb([
    { id: "s1", user_id: "u1", current_period_end: future },
    { id: "s2", user_id: "u2", current_period_end: future },
    { id: "s3", user_id: "u3", current_period_end: future },
  ]);
  const result = await runDailyExpiryBatch({
    db,
    sendReminder: async ({ subscriptionId }) =>
      subscriptionId === "s2" ? { ok: false, error: "boom" } : { ok: true },
  });
  assert.equal(result.sent, 2);
  assert.equal(result.failed, 1);
  assert.equal(result.status, "partial");
});

test("reports `failed` when nothing went out", async () => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const db = makeStubDb([{ id: "s1", user_id: "u1", current_period_end: future }]);
  const result = await runDailyExpiryBatch({
    db,
    sendReminder: async () => ({ ok: false, error: "down" }),
  });
  assert.equal(result.status, "failed");
});
