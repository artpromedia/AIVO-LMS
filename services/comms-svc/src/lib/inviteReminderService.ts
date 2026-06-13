/**
 * Sprint C-08 — comms-svc invite reminder batches.
 *
 * Two scheduled jobs, both modelled on billing-svc's
 * `trialEndingReminderService` (latch-on-success, no double-send, retried
 * next tick on a transient failure):
 *
 *   1. invites.contribution-nudge
 *      A teammate who ACCEPTED a learning-team invite ≥48h ago but hasn't yet
 *      contributed their perspective gets one warm nudge. The 7-day ledger cap
 *      is a per-member latch column (`contribution_nudge_last_sent_at`): the
 *      SELECT skips a member nudged within the last 7 days, and the latch is
 *      stamped only after a successful send. Opt-out is honored via a
 *      per-member `contribution_nudge_opt_out` flag (set when the recipient
 *      uses the unsubscribe link in the nudge email).
 *
 *   2. invites.expiry-warning
 *      A teacher→parent token invite still PENDING and expiring within 24h
 *      gets one warning to the recipient so it isn't silently lost. Latched on
 *      `expiry_warning_sent_at` so we warn exactly once per invite lifetime.
 *
 * "Contributed" mirrors the family-svc contributions endpoint: a completed
 * teacher/therapist assessment, or ≥1 caregiver observation, authored by (or,
 * for single-seat kinds, attributable to) the member.
 */
import { sql } from "drizzle-orm";
import type { JobOutcome } from "@aivo/scheduling";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_ACCEPTED_MIN_AGE_MS = 48 * HOUR_MS;
const DEFAULT_NUDGE_COOLDOWN_MS = 7 * DAY_MS;
const DEFAULT_EXPIRY_WINDOW_MS = 24 * HOUR_MS;

export interface NudgeRow {
  invite_id: string;
  kind: "teacher" | "caregiver" | "therapist";
  email: string;
  learner_id: string;
  learner_name: string | null;
  inviter_name: string | null;
}

export interface ExpiryRow {
  invite_id: string;
  parent_email: string;
  learner_name: string | null;
  teacher_name: string | null;
  expires_at: Date;
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

export interface RunNudgeInput {
  db: any;
  now?: Date;
  /** A member must have accepted at least this long ago (default 48h). */
  acceptedMinAgeMs?: number;
  /** Don't nudge the same member more than once per this window (default 7d). */
  cooldownMs?: number;
  /** Sends one nudge. Defaults to a fetch to comms-svc's internal route. */
  sendNudge?: (input: {
    inviteId: string;
    kind: NudgeRow["kind"];
    to: string;
    learnerId: string;
    learnerName: string | null;
    inviterName: string | null;
  }) => Promise<SendResult>;
}

export interface RunExpiryInput {
  db: any;
  now?: Date;
  /** Warn when an invite expires within this window (default 24h). */
  windowMs?: number;
  sendWarning?: (input: {
    inviteId: string;
    to: string;
    learnerName: string | null;
    teacherName: string | null;
    expiresAt: Date;
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

async function defaultSendNudge(input: {
  inviteId: string;
  kind: NudgeRow["kind"];
  to: string;
  learnerId: string;
  learnerName: string | null;
  inviterName: string | null;
}): Promise<SendResult> {
  const { url, key } = commsBase();
  try {
    const res = await fetch(`${url}/api/comms/internal/contribution-nudge`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": key },
      body: JSON.stringify({
        to: input.to,
        kind: input.kind,
        inviteId: input.inviteId,
        learnerName: input.learnerName ?? undefined,
        inviterName: input.inviterName ?? undefined,
      }),
    });
    if (!res.ok) return { ok: false, error: `comms-svc returned ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function defaultSendWarning(input: {
  inviteId: string;
  to: string;
  learnerName: string | null;
  teacherName: string | null;
  expiresAt: Date;
}): Promise<SendResult> {
  const { url, key } = commsBase();
  try {
    const res = await fetch(`${url}/api/comms/internal/invite-expiry-warning`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": key },
      body: JSON.stringify({
        to: input.to,
        inviteId: input.inviteId,
        learnerName: input.learnerName ?? undefined,
        teacherName: input.teacherName ?? undefined,
        expiresAt: input.expiresAt.toISOString(),
      }),
    });
    if (!res.ok) return { ok: false, error: `comms-svc returned ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Defense-in-depth: make sure the latch + opt-out columns exist even on a
 *  dev DB that hasn't run the migration yet. The real migration owns these in
 *  deployed environments. */
async function ensureNudgeColumns(db: any): Promise<void> {
  for (const table of ["learner_teachers", "learner_caregivers", "learner_therapists"]) {
    try {
      await db.execute(
        sql.raw(
          `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS contribution_nudge_last_sent_at timestamp`,
        ),
      );
      await db.execute(
        sql.raw(
          `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS contribution_nudge_opt_out boolean NOT NULL DEFAULT false`,
        ),
      );
    } catch {
      /* migrations own this in real deploys */
    }
  }
}

async function ensureExpiryColumns(db: any): Promise<void> {
  try {
    await db.execute(
      sql.raw(
        `ALTER TABLE teacher_parent_invites ADD COLUMN IF NOT EXISTS expiry_warning_sent_at timestamp`,
      ),
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
 * Select accepted-but-not-contributed members eligible for a nudge. Pure SQL
 * (no send) so the selection logic can be asserted on its own. A member is
 * eligible when:
 *   - status = ACCEPTED and accepted_at <= now - acceptedMinAgeMs
 *   - not opted out
 *   - not nudged within the cooldown window
 *   - has NO contribution of their kind (completed assessment / observation),
 *     credited by submitted_by OR — for single-seat teacher/therapist — any
 *     completed row when submitted_by is null (legacy attribution).
 */
export async function selectNudgeCandidates(input: {
  db: any;
  now: Date;
  acceptedMinAgeMs: number;
  cooldownMs: number;
}): Promise<NudgeRow[]> {
  const { db, now, acceptedMinAgeMs, cooldownMs } = input;
  const acceptedBefore = new Date(now.getTime() - acceptedMinAgeMs);
  const cooldownBefore = new Date(now.getTime() - cooldownMs);

  // One UNION per kind. For teacher/therapist the "no contribution" predicate
  // also matches unattributed completed rows (single seat ⇒ unambiguous); for
  // caregivers only an authored observation counts.
  const res = await db.execute(sql`
    WITH eligible_teacher AS (
      SELECT lt.id AS invite_id, 'teacher' AS kind, lt.teacher_email AS email,
             lt.learner_id, l.name AS learner_name, inv.name AS inviter_name
      FROM learner_teachers lt
      JOIN learners l ON l.id = lt.learner_id
      LEFT JOIN users inv ON inv.id = lt.invited_by
      WHERE lt.status = 'ACCEPTED'
        AND lt.accepted_at IS NOT NULL
        AND lt.accepted_at <= ${acceptedBefore}
        AND COALESCE(lt.contribution_nudge_opt_out, false) = false
        AND (lt.contribution_nudge_last_sent_at IS NULL
             OR lt.contribution_nudge_last_sent_at <= ${cooldownBefore})
        AND NOT EXISTS (
          SELECT 1 FROM teacher_assessments ta
          WHERE ta.learner_id = lt.learner_id
            AND ta.completed_at IS NOT NULL
            AND (ta.submitted_by = lt.teacher_user_id OR ta.submitted_by IS NULL)
        )
    ),
    eligible_therapist AS (
      SELECT th.id AS invite_id, 'therapist' AS kind, th.therapist_email AS email,
             th.learner_id, l.name AS learner_name, inv.name AS inviter_name
      FROM learner_therapists th
      JOIN learners l ON l.id = th.learner_id
      LEFT JOIN users inv ON inv.id = th.invited_by
      WHERE th.status = 'ACCEPTED'
        AND th.accepted_at IS NOT NULL
        AND th.accepted_at <= ${acceptedBefore}
        AND COALESCE(th.contribution_nudge_opt_out, false) = false
        AND (th.contribution_nudge_last_sent_at IS NULL
             OR th.contribution_nudge_last_sent_at <= ${cooldownBefore})
        AND NOT EXISTS (
          SELECT 1 FROM therapist_assessments ta
          WHERE ta.learner_id = th.learner_id
            AND ta.completed_at IS NOT NULL
            AND (ta.submitted_by = th.therapist_user_id OR ta.submitted_by IS NULL)
        )
    ),
    eligible_caregiver AS (
      SELECT lc.id AS invite_id, 'caregiver' AS kind, lc.caregiver_email AS email,
             lc.learner_id, l.name AS learner_name, inv.name AS inviter_name
      FROM learner_caregivers lc
      JOIN learners l ON l.id = lc.learner_id
      LEFT JOIN users inv ON inv.id = lc.invited_by
      WHERE lc.status = 'ACCEPTED'
        AND lc.accepted_at IS NOT NULL
        AND lc.accepted_at <= ${acceptedBefore}
        AND COALESCE(lc.contribution_nudge_opt_out, false) = false
        AND (lc.contribution_nudge_last_sent_at IS NULL
             OR lc.contribution_nudge_last_sent_at <= ${cooldownBefore})
        AND NOT EXISTS (
          SELECT 1 FROM caregiver_observations co
          WHERE co.learner_id = lc.learner_id
            AND co.submitted_by = lc.caregiver_user_id
        )
    )
    SELECT * FROM eligible_teacher
    UNION ALL SELECT * FROM eligible_therapist
    UNION ALL SELECT * FROM eligible_caregiver
  `);
  return rowsOf<NudgeRow>(res);
}

const NUDGE_TABLE: Record<NudgeRow["kind"], string> = {
  teacher: "learner_teachers",
  caregiver: "learner_caregivers",
  therapist: "learner_therapists",
};

export async function runContributionNudgeBatch(input: RunNudgeInput): Promise<RunResult> {
  const now = input.now ?? new Date();
  const acceptedMinAgeMs = input.acceptedMinAgeMs ?? DEFAULT_ACCEPTED_MIN_AGE_MS;
  const cooldownMs = input.cooldownMs ?? DEFAULT_NUDGE_COOLDOWN_MS;
  const send = input.sendNudge ?? defaultSendNudge;

  await ensureNudgeColumns(input.db);

  const candidates = await selectNudgeCandidates({
    db: input.db,
    now,
    acceptedMinAgeMs,
    cooldownMs,
  });

  let sent = 0;
  let failed = 0;
  for (const row of candidates) {
    const r = await send({
      inviteId: row.invite_id,
      kind: row.kind,
      to: row.email,
      learnerId: row.learner_id,
      learnerName: row.learner_name,
      inviterName: row.inviter_name,
    });
    if (r.ok) {
      sent++;
      // Latch only on success so a transient failure retries next tick. The
      // table is from a fixed internal allow-list (NUDGE_TABLE) — never user
      // input — so the identifier interpolation is safe; the latch value + id
      // are bound parameters.
      await input.db.execute(sql`
        UPDATE ${sql.raw(NUDGE_TABLE[row.kind])}
        SET contribution_nudge_last_sent_at = ${now}, updated_at = NOW()
        WHERE id = ${row.invite_id}
      `);
    } else {
      failed++;
    }
  }

  const status: JobOutcome["status"] = failed === 0 ? "ok" : sent > 0 ? "partial" : "failed";
  return { status, sent, failed };
}

export async function selectExpiryCandidates(input: {
  db: any;
  now: Date;
  windowMs: number;
}): Promise<ExpiryRow[]> {
  const { db, now, windowMs } = input;
  const windowEnd = new Date(now.getTime() + windowMs);
  const res = await db.execute(sql`
    SELECT tpi.id AS invite_id, tpi.parent_email, l.name AS learner_name,
           t.name AS teacher_name, tpi.expires_at
    FROM teacher_parent_invites tpi
    JOIN learners l ON l.id = tpi.learner_id
    LEFT JOIN users t ON t.id = tpi.teacher_user_id
    WHERE tpi.status = 'PENDING'
      AND tpi.expires_at IS NOT NULL
      AND tpi.expires_at >= ${now}
      AND tpi.expires_at <= ${windowEnd}
      AND tpi.expiry_warning_sent_at IS NULL
  `);
  return rowsOf<ExpiryRow>(res);
}

export async function runExpiryWarningBatch(input: RunExpiryInput): Promise<RunResult> {
  const now = input.now ?? new Date();
  const windowMs = input.windowMs ?? DEFAULT_EXPIRY_WINDOW_MS;
  const send = input.sendWarning ?? defaultSendWarning;

  await ensureExpiryColumns(input.db);

  const candidates = await selectExpiryCandidates({ db: input.db, now, windowMs });

  let sent = 0;
  let failed = 0;
  for (const row of candidates) {
    const expiresAt = row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at);
    const r = await send({
      inviteId: row.invite_id,
      to: row.parent_email,
      learnerName: row.learner_name,
      teacherName: row.teacher_name,
      expiresAt,
    });
    if (r.ok) {
      sent++;
      await input.db.execute(sql`
        UPDATE teacher_parent_invites
        SET expiry_warning_sent_at = ${now}
        WHERE id = ${row.invite_id}
      `);
    } else {
      failed++;
    }
  }

  const status: JobOutcome["status"] = failed === 0 ? "ok" : sent > 0 ? "partial" : "failed";
  return { status, sent, failed };
}

/** Scheduler wrappers. */
export async function runContributionNudgeForScheduler(db: any): Promise<JobOutcome> {
  const r = await runContributionNudgeBatch({ db });
  return { status: r.status, sent: r.sent, failed: r.failed };
}

export async function runExpiryWarningForScheduler(db: any): Promise<JobOutcome> {
  const r = await runExpiryWarningBatch({ db });
  return { status: r.status, sent: r.sent, failed: r.failed };
}
