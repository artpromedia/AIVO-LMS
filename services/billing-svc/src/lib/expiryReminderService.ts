/**
 * Sprint 7 — billing-svc daily expiry reminder batch.
 *
 * Walks `subscriptions` for rows whose `current_period_end` falls inside the
 * configured reminder window and asks comms-svc to send a renewal reminder
 * email. The work itself is idempotent because comms-svc dedups on
 * `(user_id, template_key, day)`.
 *
 * Two history tables are written here:
 *   - `daily_job_runs` (fleet-wide ledger, written by `@aivo/scheduling`).
 *   - `billing_daily_job_runs` (billing-only history, last 30 ticks per job)
 *     — written here so the admin Daily Batch Leader card can show a sparkline
 *     of recent runs without joining against the generic periodic_job_runs
 *     table.
 *
 * The original implementation that shipped with Task #54 referenced `sql\`...\``
 * without an import; that ReferenceError caused every tick to fail (Task #65).
 * We import `sql` explicitly here.
 */
import { sql } from "drizzle-orm";
import { billingDailyJobRuns, subscriptions } from "@aivo/db";
import type { JobOutcome } from "@aivo/scheduling";

export interface RunBatchInput {
  db: any;
  now?: Date;
  /** Window (in days) to look ahead for upcoming expiries. */
  reminderWindowDays?: number;
  /** Posts a renewal reminder. Defaults to a fetch to comms-svc. */
  sendReminder?: (input: {
    subscriptionId: string;
    userId: string;
    expiresAt: Date;
  }) => Promise<{ ok: boolean; error?: string }>;
  replicaId?: string;
  jobName?: string;
  /** History prune size, default 30 (Task #60). */
  historyLimit?: number;
}

export interface RunBatchResult extends JobOutcome {
  sent: number;
  failed: number;
  expired: number;
}

const DEFAULT_REMINDER_WINDOW_DAYS = 7;
const DEFAULT_HISTORY_LIMIT = 30;

async function defaultSendReminder(input: {
  subscriptionId: string;
  userId: string;
  expiresAt: Date;
}): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.COMMS_SVC_URL ?? "http://comms-svc:3010";
  try {
    const res = await fetch(`${url}/api/comms/notifications`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: input.userId,
        templateKey: "billing.subscription_expiry",
        params: {
          subscriptionId: input.subscriptionId,
          expiresAt: input.expiresAt.toISOString(),
        },
      }),
    });
    if (!res.ok) return { ok: false, error: `comms-svc returned ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function runDailyExpiryBatch(input: RunBatchInput): Promise<RunBatchResult> {
  const now = input.now ?? new Date();
  const windowDays = input.reminderWindowDays ?? DEFAULT_REMINDER_WINDOW_DAYS;
  const send = input.sendReminder ?? defaultSendReminder;
  const replicaId = input.replicaId ?? `${process.pid}`;
  const jobName = input.jobName ?? "billing.daily-expiry-reminders";
  const historyLimit = input.historyLimit ?? DEFAULT_HISTORY_LIMIT;

  const windowEnd = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

  // Use the imported `sql` template explicitly — this is the bug Task #65 fixes.
  const dueRows = (await input.db.execute(sql`
    SELECT s.id, s.user_id, s.current_period_end
    FROM subscriptions s
    WHERE s.status = 'ACTIVE'
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end >= ${now}
      AND s.current_period_end <= ${windowEnd}
  `)) as { rows?: Array<{ id: string; user_id: string; current_period_end: Date }> }
    | Array<{ id: string; user_id: string; current_period_end: Date }>;
  const rows = Array.isArray(dueRows) ? dueRows : (dueRows.rows ?? []);

  let sent = 0;
  let failed = 0;
  let expired = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const expiresAt = row.current_period_end instanceof Date
      ? row.current_period_end
      : new Date(row.current_period_end);
    if (expiresAt.getTime() <= now.getTime()) expired++;
    const r = await send({
      subscriptionId: row.id,
      userId: row.user_id,
      expiresAt,
    });
    if (r.ok) sent++;
    else {
      failed++;
      if (r.error) errors.push(r.error);
    }
  }

  const status: JobOutcome["status"] =
    failed === 0 ? "ok" : sent > 0 ? "partial" : "failed";

  // Write per-job history for the admin Daily Batch card.
  const startedAt = now;
  const finishedAt = new Date();
  await input.db.execute(sql`
    INSERT INTO billing_daily_job_runs
      (job_name, run_at, finished_at, replica_id, status, sent, failed, duration_ms, error)
    VALUES
      (${jobName}, ${startedAt}, ${finishedAt}, ${replicaId}, ${status},
       ${sent}, ${failed}, ${finishedAt.getTime() - startedAt.getTime()},
       ${errors.length ? errors.slice(0, 5).join("; ") : null})
  `);
  // Best-effort prune. A SQL janitor (Task #72) provides defense-in-depth.
  try {
    await input.db.execute(sql`
      DELETE FROM billing_daily_job_runs
      WHERE job_name = ${jobName}
        AND id NOT IN (
          SELECT id FROM billing_daily_job_runs
          WHERE job_name = ${jobName}
          ORDER BY run_at DESC
          LIMIT ${historyLimit}
        )
    `);
  } catch {
    /* swallowed: janitor handles unbounded growth */
  }

  return { status, sent, failed, expired };
}

/**
 * Convenience: a `JobOutcome`-shaped wrapper that the shared scheduler can
 * call directly via `run: () => runExpiryBatchForScheduler(db)`.
 */
export async function runExpiryBatchForScheduler(db: any): Promise<JobOutcome> {
  const result = await runDailyExpiryBatch({ db });
  return { status: result.status, sent: result.sent, failed: result.failed };
}

export { subscriptions, billingDailyJobRuns };
