/**
 * Sprint C-13 — brain-profile change reminder batch logic (selection, opt-out
 * filtering, latch-on-success) with a recording fake of the Drizzle handle.
 *
 * We don't stand up Postgres here: the selection predicate (structural,
 * un-acked, older than 7 days, not yet reminded) is expressed in SQL, so we
 * assert the ORCHESTRATION the service owns:
 *   - every selected candidate is reminded exactly once;
 *   - the per-change latch UPDATE fires after a successful send (so the
 *     one-reminder-per-change cap holds and a transient failure retries);
 *   - a parent who opted out of the brain_profile_changed email is skipped
 *     (latched so it isn't re-evaluated, but never sent);
 *   - a candidate with no reachable parent email is skipped + latched.
 *
 * The literal SELECT (which encodes requires_ack / acked_at / reminder_sent_at /
 * age guards) is asserted too, so a refactor that drops a guard is caught.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runBrainChangeReminderBatch,
  type ChangeReminderRow,
} from "../src/lib/brainChangeReminderService.js";

function sqlText(q: any): string {
  if (typeof q === "string") return q;
  if (Array.isArray(q?.value)) return q.value.join("");
  const chunks = q?.queryChunks;
  if (Array.isArray(chunks)) {
    let out = "";
    for (const c of chunks) {
      if (c && Array.isArray(c.value)) out += c.value.join("");
      else if (c && Array.isArray(c.queryChunks)) out += sqlText(c);
      else out += " ? ";
    }
    return out;
  }
  return "";
}

function fakeDb(rows: any[]) {
  const updates: string[] = [];
  const selects: string[] = [];
  const db = {
    async execute(q: any) {
      const text = sqlText(q).trim();
      if (/^ALTER TABLE/i.test(text)) return { rows: [] };
      if (/^\s*SELECT/i.test(text)) {
        selects.push(text);
        return { rows };
      }
      if (/^UPDATE/i.test(text)) {
        updates.push(text);
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
  return { db, updates, selects };
}

const ROW: ChangeReminderRow = {
  change_id: "bpc-1",
  learner_id: "lrn-1",
  tenant_id: "t-1",
  learner_name: "Maya",
  parent_id: "u-parent-1",
  parent_email: "parent@example.com",
  parent_prefs: null, // no prefs row → default-on
};

test("reminder: sends each candidate once and latches after a successful send", async () => {
  const { db, updates } = fakeDb([ROW, { ...ROW, change_id: "bpc-2" }]);
  const sent: string[] = [];
  const res = await runBrainChangeReminderBatch({
    db,
    sendReminder: async (i) => {
      sent.push(i.changeId);
      return { ok: true };
    },
  });
  assert.equal(res.sent, 2);
  assert.equal(res.failed, 0);
  assert.equal(res.status, "ok");
  assert.deepEqual(sent.sort(), ["bpc-1", "bpc-2"]);
  // One latch UPDATE per successful send.
  assert.equal(updates.length, 2);
  assert.ok(updates.every((u) => /reminder_sent_at/i.test(u)));
});

test("reminder: a transient send failure does NOT latch (retries next tick)", async () => {
  const { db, updates } = fakeDb([ROW]);
  const res = await runBrainChangeReminderBatch({
    db,
    sendReminder: async () => ({ ok: false, error: "boom" }),
  });
  assert.equal(res.sent, 0);
  assert.equal(res.failed, 1);
  assert.equal(res.status, "failed");
  assert.equal(updates.length, 0, "no latch on failure — must retry next tick");
});

test("reminder: a parent opted out of brain_profile_changed email is skipped + latched", async () => {
  const optedOut: ChangeReminderRow = {
    ...ROW,
    parent_prefs: { "brain_profile_changed:email": false },
  };
  const { db, updates } = fakeDb([optedOut]);
  let sends = 0;
  const res = await runBrainChangeReminderBatch({
    db,
    sendReminder: async () => {
      sends++;
      return { ok: true };
    },
  });
  assert.equal(sends, 0, "opted-out parent is never emailed");
  assert.equal(res.sent, 0);
  assert.equal(res.failed, 0);
  // Latched so the batch doesn't re-evaluate it every tick.
  assert.equal(updates.length, 1);
});

test("reminder: a candidate with no parent email is skipped + latched", async () => {
  const noEmail: ChangeReminderRow = { ...ROW, parent_email: null };
  const { db, updates } = fakeDb([noEmail]);
  let sends = 0;
  const res = await runBrainChangeReminderBatch({
    db,
    sendReminder: async () => {
      sends++;
      return { ok: true };
    },
  });
  assert.equal(sends, 0);
  assert.equal(res.sent, 0);
  assert.equal(updates.length, 1);
});

test("reminder: the SELECT encodes the structural / un-acked / age / not-reminded guards", async () => {
  const { db, selects } = fakeDb([]);
  await runBrainChangeReminderBatch({ db, sendReminder: async () => ({ ok: true }) });
  assert.equal(selects.length, 1);
  const sel = selects[0].toLowerCase().replace(/\s+/g, " ");
  assert.ok(sel.includes("requires_ack = true"), "must select only structural changes");
  assert.ok(sel.includes("acked_at is null"), "must skip already-acked changes");
  assert.ok(sel.includes("reminder_sent_at is null"), "must skip already-reminded changes");
  assert.ok(sel.includes("created_at <="), "must apply the age cutoff");
  assert.ok(
    sel.includes("web_notification_preferences"),
    "must join the parent's notification preference for the opt-out check",
  );
});
