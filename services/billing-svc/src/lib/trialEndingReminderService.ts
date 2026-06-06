/**
 * Trials Sprint 1 — billing-svc daily trial-ending reminder batch.
 *
 * Finds subscriptions with status = TRIALING whose `trial_ends_at` falls within
 * the reminder window (default 3 days) and asks comms-svc to send the
 * `trial_ending` notification (email + in-app). Exactly-once is guaranteed by a
 * dedicated notified-at latch column `trial_ending_reminder_sent_at`: the SELECT
 * skips already-notified rows, and the latch is only set AFTER a successful
 * send, so retries never double-send and a transient comms failure is retried
 * on the next tick.
 *
 * Modeled on `expiryReminderService.ts`; writes the same `billing_daily_job_runs`
 * history for the admin Daily Batch card.
 */
import { sql } from "drizzle-orm";
import type { JobOutcome } from "@aivo/scheduling";

export interface TrialReminderRow {
  id: string;
  user_id: string;
  tenant_id: string;
  trial_ends_at: Date;
  email: string | null;
  name: string | null;
}

export interface RunTrialBatchInput {
  db: any;
  now?: Date;
  /** Look-ahead window in days (default 3). */
  reminderWindowDays?: number;
  /** Sends the reminder. Defaults to a fetch to comms-svc's internal route. */
  sendReminder?: (input: {
    subscriptionId: string;
    userId: string;
    tenantId: string;
    email: string | null;
    name: string | null;
    trialEndsAt: Date;
    daysLeft: number;
  }) => Promise<{ ok: boolean; error?: string }>;
  replicaId?: string;
  jobName?: string;
  historyLimit?: number;
}

export interface RunTrialBatchResult extends JobOutcome {
  sent: number;
  failed: number;
}

const DEFAULT_REMINDER_WINDOW_DAYS = 3;
const DEFAULT_HISTORY_LIMIT = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function renewalUrl(): string {
  const base = process.env.WEB_APP_URL ?? "https://app.aivolearning.com";
  return `${base.replace(/\/$/, "")}/parent/settings/billing`;
}

async function defaultSendReminder(input: {
  subscriptionId: string;
  userId: string;
  tenantId: string;
  email: string | null;
  name: string | null;
  trialEndsAt: Date;
  daysLeft: number;
}): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.COMMS_SVC_URL ?? "http://comms-svc:3010";
  const internalKey = process.env.INTERNAL_SERVICE_KEY || "aivo-internal-dev-key";
  try {
    const res = await fetch(`${url}/api/comms/internal/trial-ending`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": internalKey },
      body: JSON.stringify({
        to: input.email ?? undefined,
        name: input.name ?? undefined,
        parentId: input.userId,
        trialEndDate: input.trialEndsAt.toISOString().slice(0, 10),
        daysLeft: input.daysLeft,
        renewalUrl: renewalUrl(),
      }),
    });
    if (!res.ok) return { ok: false, error: `comms-svc returned ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function runDailyTrialEndingBatch(
  input: RunTrialBatchInput,
): Promise<RunTrialBatchResult> {
  const now = input.now ?? new Date();
  const windowDays = input.reminderWindowDays ?? DEFAULT_REMINDER_WINDOW_DAYS;
  const send = input.sendReminder ?? defaultSendReminder;
  const replicaId = input.replicaId ?? `${process.pid}`;
  const jobName = input.jobName ?? "billing.daily-trial-ending-reminders";
  const historyLimit = input.historyLimit ?? DEFAULT_HISTORY_LIMIT;
  const windowEnd = new Date(now.getTime() + windowDays * DAY_MS);

  // Defense-in-depth: ensure the latch column exists even on a dev DB that
  // hasn't run migration 0066.
  try {
    await input.db.execute(
      sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_ending_reminder_sent_at timestamp`,
    );
  } catch {
    /* migrations own this in real deploys */
  }

  // Only TRIALING subs ending inside the window that have NOT been notified.
  const dueRows = (await input.db.execute(sql`
    SELECT s.id, s.user_id, s.tenant_id, s.trial_ends_at, u.email, u.name
    FROM subscriptions s
    JOIN users u ON u.id = s.user_id
    WHERE s.status = 'TRIALING'
      AND s.trial_ends_at IS NOT NULL
      AND s.trial_ends_at >= ${now}
      AND s.trial_ends_at <= ${windowEnd}
      AND s.trial_ending_reminder_sent_at IS NULL
  `)) as { rows?: TrialReminderRow[] } | TrialReminderRow[];
  const rows = Array.isArray(dueRows) ? dueRows : (dueRows.rows ?? []);

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const trialEndsAt =
      row.trial_ends_at instanceof Date ? row.trial_ends_at : new Date(row.trial_ends_at);
    const daysLeft = Math.max(0, Math.round((trialEndsAt.getTime() - now.getTime()) / DAY_MS));

    const r = await send({
      subscriptionId: row.id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      email: row.email,
      name: row.name,
      trialEndsAt,
      daysLeft,
    });

    if (r.ok) {
      sent++;
      // Latch ONLY on success, so a failed send is retried next tick.
      await input.db.execute(sql`
        UPDATE subscriptions
        SET trial_ending_reminder_sent_at = ${now}, updated_at = NOW()
        WHERE id = ${row.id}
      `);
    } else {
      failed++;
      if (r.error) errors.push(r.error);
    }
  }

  const status: JobOutcome["status"] = failed === 0 ? "ok" : sent > 0 ? "partial" : "failed";

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
    /* janitor handles unbounded growth */
  }

  return { status, sent, failed };
}

/** Scheduler wrapper: `run: () => runTrialEndingBatchForScheduler(db)`. */
export async function runTrialEndingBatchForScheduler(db: any): Promise<JobOutcome> {
  const result = await runDailyTrialEndingBatch({ db });
  return { status: result.status, sent: result.sent, failed: result.failed };
}
