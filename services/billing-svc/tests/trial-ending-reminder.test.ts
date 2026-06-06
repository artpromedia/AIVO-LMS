/**
 * Trial-ending reminder batch — unit tests with a stub DB (no database).
 * Verifies counting, the success-only latch (idempotency), and partial status.
 */
import { test } from "node:test";
import assert from "node:assert";
import { runDailyTrialEndingBatch } from "../src/lib/trialEndingReminderService.js";

function queryText(q: any): string {
  const chunks = q?.queryChunks ?? [];
  return chunks
    .map((c: any) => {
      if (typeof c === "string") return c;
      // drizzle StringChunk carries the literal SQL in a string[] `value`.
      if (c && Array.isArray(c.value)) return c.value.join("");
      return " ? ";
    })
    .join("");
}

function makeStubDb(rows: any[]) {
  const queries: string[] = [];
  return {
    queries,
    execute(q: any) {
      const text = queryText(q);
      queries.push(text);
      // The due-rows SELECT is the only one that joins users; return rows there.
      if (/SELECT/i.test(text) && /JOIN\s+users/i.test(text)) {
        return Promise.resolve({ rows });
      }
      return Promise.resolve({ rows: [] });
    },
  };
}

const future = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

function row(id: string) {
  return {
    id,
    user_id: `u_${id}`,
    tenant_id: `t_${id}`,
    trial_ends_at: future(2),
    email: `${id}@example.com`,
    name: "Trial User",
  };
}

test("no due rows → ok, nothing sent", async () => {
  const db = makeStubDb([]);
  const result = await runDailyTrialEndingBatch({ db, sendReminder: async () => ({ ok: true }) });
  assert.equal(result.status, "ok");
  assert.equal(result.sent, 0);
});

test("sends once per due row and latches on success", async () => {
  const db = makeStubDb([row("s1"), row("s2")]);
  const seen: string[] = [];
  const result = await runDailyTrialEndingBatch({
    db,
    sendReminder: async ({ subscriptionId, daysLeft }) => {
      seen.push(subscriptionId);
      assert.equal(daysLeft, 2);
      return { ok: true };
    },
  });
  assert.equal(result.sent, 2);
  assert.equal(result.failed, 0);
  // One latch UPDATE per successfully-notified row → idempotent next run.
  const latches = db.queries.filter(
    (q) => /UPDATE\s+subscriptions/i.test(q) && /trial_ending_reminder_sent_at/i.test(q),
  );
  assert.equal(latches.length, 2);
  assert.deepEqual(seen.sort(), ["s1", "s2"]);
});

test("does not latch a failed send (so it retries next tick)", async () => {
  const db = makeStubDb([row("s1"), row("s2")]);
  const result = await runDailyTrialEndingBatch({
    db,
    sendReminder: async ({ subscriptionId }) =>
      subscriptionId === "s2" ? { ok: false, error: "comms down" } : { ok: true },
  });
  assert.equal(result.sent, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.status, "partial");
  const latches = db.queries.filter(
    (q) => /UPDATE\s+subscriptions/i.test(q) && /trial_ending_reminder_sent_at/i.test(q),
  );
  assert.equal(latches.length, 1); // only the successful one
});

test("the due-rows query filters to TRIALING + unnotified", async () => {
  const db = makeStubDb([]);
  await runDailyTrialEndingBatch({ db, sendReminder: async () => ({ ok: true }) });
  const select = db.queries.find((q) => /JOIN\s+users/i.test(q));
  assert.ok(select);
  assert.match(select!, /status\s*=\s*'TRIALING'/i);
  assert.match(select!, /trial_ending_reminder_sent_at\s+IS\s+NULL/i);
});
