/**
 * Sprint C-13 — comms-svc brain-profile change reminder batch.
 *
 * One scheduled job, modelled exactly on C-08's `inviteReminderService`
 * (latch-on-success, no double-send, retried next tick on a transient failure):
 *
 *   brain.change-review-reminder
 *     A STRUCTURAL change to a learner's brain profile that the parent has not
 *     acknowledged within BRAIN_CHANGE_REMINDER_AFTER_DAYS (7) gets ONE warm
 *     reminder to the primary parent. The ledger cap is a per-change latch
 *     column (`reminder_sent_at`): the SELECT skips a change already reminded,
 *     and the latch is stamped only after a successful send. Opt-out is honored
 *     via the parent's web notification preference for `brain_profile_changed`
 *     (the same single toggle that governs the immediate change notice) — a
 *     parent who turned that channel off is never reminded.
 *
 * The N-day acknowledgement window is NON-BLOCKING: teaching never stops when
 * it lapses (that is enforced web-side — the approved profile keeps teaching).
 * When the window lapses the un-acked change escalates to a persistent in-app
 * badge (rendered web-side from `listPendingStructuralChanges`); this job only
 * sends the single 7-day email nudge.
 *
 * This reads the shared `brain_profile_changes` table (@aivo/db, migration
 * 0115) that web-v2's persistence layer writes to in postgres mode — in
 * production both services point at the same database.
 */
import { sql } from "drizzle-orm";
import { BRAIN_CHANGE_REMINDER_AFTER_DAYS } from "@aivo/db";
import type { JobOutcome } from "@aivo/scheduling";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_REMINDER_AFTER_MS = BRAIN_CHANGE_REMINDER_AFTER_DAYS * DAY_MS;

export interface ChangeReminderRow {
  change_id: string;
  learner_id: string;
  tenant_id: string;
  learner_name: string | null;
  parent_id: string | null;
  parent_email: string | null;
  /** The parent's web notification-preference blob (or null). */
  parent_prefs: Record<string, boolean> | null;
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

export interface RunChangeReminderInput {
  db: any;
  now?: Date;
  /** A change must be at least this old (default 7d). */
  reminderAfterMs?: number;
  /** Sends one reminder. Defaults to a fetch to comms-svc's internal route. */
  sendReminder?: (input: {
    changeId: string;
    to: string;
    parentId: string;
    learnerId: string;
    learnerName: string | null;
  }) => Promise<SendResult>;
}

export interface RunResult extends JobOutcome {
  sent: number;
  failed: number;
}

function commsBase(): { url: string; key: string } {
  return {
    url: process.env.COMMS_SVC_URL ?? "http://localhost:3010",
    key: process.env.INTERNAL_SERVICE_KEY || "aivo-internal-dev-key",
  };
}

async function defaultSendReminder(input: {
  changeId: string;
  to: string;
  parentId: string;
  learnerId: string;
  learnerName: string | null;
}): Promise<SendResult> {
  const { url, key } = commsBase();
  try {
    const res = await fetch(`${url}/api/comms/internal/brain-change-reminder`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": key },
      body: JSON.stringify({
        to: input.to,
        changeId: input.changeId,
        parentId: input.parentId,
        learnerId: input.learnerId,
        learnerName: input.learnerName ?? undefined,
      }),
    });
    if (!res.ok) return { ok: false, error: `comms-svc returned ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Defense-in-depth: make sure the latch column exists even on a dev DB that
 *  hasn't run migration 0115 yet. The real migration owns it in deployments. */
async function ensureReminderColumn(db: any): Promise<void> {
  try {
    await db.execute(
      sql.raw(`ALTER TABLE brain_profile_changes ADD COLUMN IF NOT EXISTS reminder_sent_at text`),
    );
  } catch {
    /* migrations own this in real deploys */
  }
}

function rowsOf<T>(r: unknown): T[] {
  if (Array.isArray(r)) return r as T[];
  const obj = r as { rows?: T[] };
  return obj?.rows ?? [];
}

/**
 * Select un-acked structural changes older than the reminder window that have
 * not yet been reminded. Pure SQL (no send) so selection can be asserted alone.
 * Joins the learner's primary parent (learners.parent_id) and that parent's
 * email + notification-preference blob. `created_at` is a TEXT ISO timestamp
 * (the web-v2 convention for this table), compared lexicographically against an
 * ISO cutoff — safe because ISO-8601 sorts chronologically.
 */
export async function selectChangeReminderCandidates(input: {
  db: any;
  now: Date;
  reminderAfterMs: number;
}): Promise<ChangeReminderRow[]> {
  const { db, now, reminderAfterMs } = input;
  const cutoffIso = new Date(now.getTime() - reminderAfterMs).toISOString();
  const res = await db.execute(sql`
    SELECT c.id AS change_id, c.learner_id, c.tenant_id,
           l.name AS learner_name, l.parent_id AS parent_id,
           u.email AS parent_email,
           np.data AS parent_prefs
    FROM brain_profile_changes c
    JOIN learners l ON l.id = c.learner_id
    LEFT JOIN users u ON u.id = l.parent_id
    LEFT JOIN web_notification_preferences np ON np.user_id = l.parent_id
    WHERE c.requires_ack = true
      AND c.acked_at IS NULL
      AND c.reminder_sent_at IS NULL
      AND c.created_at <= ${cutoffIso}
  `);
  return rowsOf<ChangeReminderRow>(res);
}

/** True iff the parent has the brain_profile_changed email channel ON (or has
 *  no preference row yet — the default is ON). Honors the single opt-out toggle
 *  that also governs the immediate change notice. */
function emailOptedIn(prefs: Record<string, boolean> | null): boolean {
  if (!prefs) return true; // no row yet → default-on (matches web defaultPreferenceMap)
  const v = prefs["brain_profile_changed:email"];
  return v !== false; // explicit false means opted out; undefined → default-on
}

export async function runBrainChangeReminderBatch(
  input: RunChangeReminderInput,
): Promise<RunResult> {
  const now = input.now ?? new Date();
  const reminderAfterMs = input.reminderAfterMs ?? DEFAULT_REMINDER_AFTER_MS;
  const send = input.sendReminder ?? defaultSendReminder;

  await ensureReminderColumn(input.db);

  const candidates = await selectChangeReminderCandidates({ db: input.db, now, reminderAfterMs });

  let sent = 0;
  let failed = 0;
  for (const row of candidates) {
    // No reachable recipient, or the parent opted out of this email — latch it
    // so we don't re-evaluate it every tick, but count it as neither sent nor
    // failed (it was correctly skipped).
    if (!row.parent_id || !row.parent_email || !emailOptedIn(row.parent_prefs)) {
      await input.db.execute(sql`
        UPDATE brain_profile_changes
        SET reminder_sent_at = ${now.toISOString()}
        WHERE id = ${row.change_id}
      `);
      continue;
    }
    const r = await send({
      changeId: row.change_id,
      to: row.parent_email,
      parentId: row.parent_id,
      learnerId: row.learner_id,
      learnerName: row.learner_name,
    });
    if (r.ok) {
      sent++;
      // Latch only on success so a transient failure retries next tick.
      await input.db.execute(sql`
        UPDATE brain_profile_changes
        SET reminder_sent_at = ${now.toISOString()}
        WHERE id = ${row.change_id}
      `);
    } else {
      failed++;
    }
  }

  const status: JobOutcome["status"] = failed === 0 ? "ok" : sent > 0 ? "partial" : "failed";
  return { status, sent, failed };
}

/** Scheduler wrapper. */
export async function runBrainChangeReminderForScheduler(db: any): Promise<JobOutcome> {
  const r = await runBrainChangeReminderBatch({ db });
  return { status: r.status, sent: r.sent, failed: r.failed };
}
