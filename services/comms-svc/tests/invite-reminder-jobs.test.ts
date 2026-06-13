/**
 * Sprint C-08 — invite reminder batch logic (selection, ledger cap, opt-out
 * filtering, latch-on-success) with a recording fake of the Drizzle handle.
 *
 * We don't stand up Postgres here: the selection predicate (accepted ≥48h, not
 * opted out, not nudged within 7 days, no contribution) is expressed in SQL, so
 * we assert the ORCHESTRATION the service owns:
 *   - every selected candidate is sent exactly once;
 *   - the per-member latch UPDATE fires ONLY on a successful send (so the
 *     7-day cap is enforced and a transient failure retries next tick);
 *   - opt-out / cap are honored by the SELECT (the fake returns the rows the
 *     SELECT "found", and we assert no extra sends/latches happen);
 *   - the expiry-warning batch latches expiry_warning_sent_at on success.
 *
 * The literal copy of the SELECT (which encodes the cap + opt-out predicates)
 * is asserted too, so a refactor that drops a guard is caught.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runContributionNudgeBatch,
  runExpiryWarningBatch,
  type NudgeRow,
  type ExpiryRow,
} from "../src/lib/inviteReminderService.js";

/** Flatten a drizzle `sql` object back to its literal text (params elided) so
 *  a fake can branch on statement kind + assert guards are present. Recurses
 *  into nested SQL chunks (e.g. `sql.raw(table)` interpolated identifiers). */
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

/**
 * Recording fake. `select` rows are returned for the first SELECT; UPDATE and
 * ALTER statements are recorded. ALTERs (ensure-columns) are no-ops.
 */
function fakeDb(rows: any[]) {
  const updates: string[] = [];
  let selectCount = 0;
  const db = {
    async execute(q: any) {
      const text = sqlText(q).trim();
      if (/^ALTER TABLE/i.test(text)) return { rows: [] };
      if (/^\s*WITH|^\s*SELECT/i.test(text)) {
        selectCount++;
        return { rows };
      }
      if (/^UPDATE/i.test(text)) {
        updates.push(text);
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
  return { db, updates, selectCount: () => selectCount };
}

const NUDGE_ROW: NudgeRow = {
  invite_id: "inv-teacher-1",
  kind: "teacher",
  email: "teacher@example.com",
  learner_id: "lrn-1",
  learner_name: "Sky",
  inviter_name: "The Rivera family",
};

test("nudge: sends each candidate once and latches ONLY on success", async () => {
  const { db, updates } = fakeDb([NUDGE_ROW, { ...NUDGE_ROW, invite_id: "inv-cg-1", kind: "caregiver" }]);
  const sentTo: string[] = [];
  const res = await runContributionNudgeBatch({
    db,
    sendNudge: async (i) => {
      sentTo.push(i.inviteId);
      return { ok: true };
    },
  });
  assert.equal(res.sent, 2);
  assert.equal(res.failed, 0);
  assert.equal(res.status, "ok");
  assert.deepEqual(sentTo.sort(), ["inv-cg-1", "inv-teacher-1"]);
  // One latch UPDATE per successful send, against the right tables.
  assert.equal(updates.length, 2);
  assert.ok(updates.some((u) => /learner_teachers/.test(u) && /contribution_nudge_last_sent_at/.test(u)));
  assert.ok(updates.some((u) => /learner_caregivers/.test(u) && /contribution_nudge_last_sent_at/.test(u)));
});

test("nudge: a failed send does NOT latch (retried next tick)", async () => {
  const { db, updates } = fakeDb([NUDGE_ROW]);
  const res = await runContributionNudgeBatch({
    db,
    sendNudge: async () => ({ ok: false, error: "comms 500" }),
  });
  assert.equal(res.sent, 0);
  assert.equal(res.failed, 1);
  assert.equal(res.status, "failed");
  assert.equal(updates.length, 0, "no latch when the send failed");
});

test("nudge: partial status when some succeed and some fail", async () => {
  const { db } = fakeDb([NUDGE_ROW, { ...NUDGE_ROW, invite_id: "inv-2" }]);
  let n = 0;
  const res = await runContributionNudgeBatch({
    db,
    sendNudge: async () => {
      n++;
      return n === 1 ? { ok: true } : { ok: false, error: "x" };
    },
  });
  assert.equal(res.sent, 1);
  assert.equal(res.failed, 1);
  assert.equal(res.status, "partial");
});

test("nudge: empty candidate set is a clean no-op", async () => {
  const { db, updates } = fakeDb([]);
  let sends = 0;
  const res = await runContributionNudgeBatch({
    db,
    sendNudge: async () => {
      sends++;
      return { ok: true };
    },
  });
  assert.equal(res.sent, 0);
  assert.equal(res.failed, 0);
  assert.equal(res.status, "ok");
  assert.equal(sends, 0);
  assert.equal(updates.length, 0);
});

test("nudge: SELECT encodes the 7-day cap + opt-out + no-contribution guards", async () => {
  const captured: string[] = [];
  const db = {
    async execute(q: any) {
      const text = sqlText(q);
      captured.push(text);
      if (/WITH|SELECT/i.test(text) && !/ALTER/i.test(text)) return { rows: [] };
      return { rows: [] };
    },
  };
  await runContributionNudgeBatch({ db });
  const select = captured.find((t) => /eligible_teacher/i.test(t)) ?? "";
  // Cap: skip members nudged within the cooldown window.
  assert.match(select, /contribution_nudge_last_sent_at IS NULL/i);
  assert.match(select, /contribution_nudge_last_sent_at <=/i);
  // Opt-out honored.
  assert.match(select, /contribution_nudge_opt_out/i);
  // Accepted-≥48h gate.
  assert.match(select, /accepted_at <=/i);
  assert.match(select, /status = 'ACCEPTED'/i);
  // No-contribution predicate per kind.
  assert.match(select, /teacher_assessments/i);
  assert.match(select, /therapist_assessments/i);
  assert.match(select, /caregiver_observations/i);
});

const EXPIRY_ROW: ExpiryRow = {
  invite_id: "tpi-1",
  parent_email: "parent@example.com",
  learner_name: "Robin",
  teacher_name: "Ms. Rivera",
  expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000),
};

test("expiry-warning: warns each pending-expiring invite once and latches on success", async () => {
  const { db, updates } = fakeDb([EXPIRY_ROW]);
  const sent: string[] = [];
  const res = await runExpiryWarningBatch({
    db,
    sendWarning: async (i) => {
      sent.push(i.to);
      return { ok: true };
    },
  });
  assert.equal(res.sent, 1);
  assert.equal(res.status, "ok");
  assert.deepEqual(sent, ["parent@example.com"]);
  assert.ok(updates.some((u) => /teacher_parent_invites/.test(u) && /expiry_warning_sent_at/.test(u)));
});

test("expiry-warning: failed send does NOT latch", async () => {
  const { db, updates } = fakeDb([EXPIRY_ROW]);
  const res = await runExpiryWarningBatch({
    db,
    sendWarning: async () => ({ ok: false, error: "down" }),
  });
  assert.equal(res.sent, 0);
  assert.equal(res.failed, 1);
  assert.equal(updates.length, 0);
});

test("expiry-warning: SELECT encodes PENDING + within-window + not-already-warned", async () => {
  const captured: string[] = [];
  const db = {
    async execute(q: any) {
      const text = sqlText(q);
      captured.push(text);
      return { rows: [] };
    },
  };
  await runExpiryWarningBatch({ db });
  const select = captured.find((t) => /teacher_parent_invites/i.test(t) && /SELECT/i.test(t)) ?? "";
  assert.match(select, /status = 'PENDING'/i);
  assert.match(select, /expires_at <=/i);
  assert.match(select, /expiry_warning_sent_at IS NULL/i);
});
