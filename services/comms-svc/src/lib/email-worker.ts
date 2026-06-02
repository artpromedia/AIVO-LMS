/**
 * Email-outbox drain worker. Runs inside comms-svc on a short interval and
 * races for a Postgres advisory lock so only one replica drains at a time.
 *
 * Each tick:
 *   1. Try to acquire the advisory lock. Bail if another replica holds it.
 *   2. Recover any rows stuck in 'sending' (worker crashed mid-send).
 *   3. Reserve a batch of due rows (FOR UPDATE SKIP LOCKED, flips them to
 *      'sending' in the same statement).
 *   4. For each row, call the underlying Postmark API directly. On success
 *      stamp provider_message_id; on failure schedule the next retry with
 *      exponential backoff or move to dead_letter if attempts are exhausted.
 *
 * Postmark 4xx codes that indicate the message itself is the problem
 * (bad address, blocked recipient, etc.) are treated as permanent — no
 * point retrying a malformed envelope.
 */
import { sql } from "drizzle-orm";
import { createLogger } from "@aivo/observability";
import {
  reservePendingBatch,
  markSent,
  markFailure,
  recoverStuckSending,
  type ReservedEmailRow,
} from "./email-outbox.js";
import { _sendEmailDirect, _sendTemplateEmailDirect, isConfigured } from "./postmark.js";

const logger = createLogger("comms-svc:email-worker");
const JOB_NAME = "comms.email-outbox-drain";

export interface EmailWorkerOptions {
  batchSize?: number;
  tickIntervalMs?: number;
  stuckSendingThresholdMs?: number;
  /** Override for tests; replaces the live drain step with a stub. */
  drainOnce?: (db: any) => Promise<DrainOutcome>;
}

export interface DrainOutcome {
  reserved: number;
  sent: number;
  failed: number;
  deadLettered: number;
  recovered: number;
  notLeader?: boolean;
  notConfigured?: boolean;
}

interface DbLike {
  execute: (q: ReturnType<typeof sql>) => Promise<unknown>;
}

function unwrapRows<R>(result: unknown): R[] {
  if (Array.isArray(result)) return result as R[];
  if (result && typeof result === "object" && "rows" in (result as Record<string, unknown>)) {
    return ((result as { rows?: R[] }).rows ?? []) as R[];
  }
  return [];
}

/** FNV-1a 64-bit hash of the job name, converted to a signed bigint that
 *  pg_advisory_lock accepts. Matches @aivo/scheduling's internal hash so
 *  the two leadership domains don't collide on identical names. */
function jobNameToLockKey(jobName: string): bigint {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < jobName.length; i++) {
    hash ^= BigInt(jobName.charCodeAt(i));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  if (hash >= 0x8000000000000000n) hash -= 0x10000000000000000n;
  return hash;
}

async function tryAcquireLock(db: DbLike): Promise<(() => Promise<void>) | null> {
  const key = jobNameToLockKey(JOB_NAME);
  const result = await db.execute(sql`SELECT pg_try_advisory_lock(${key}::bigint) AS acquired`);
  const rows = unwrapRows<{ acquired: boolean }>(result);
  if (!rows[0]?.acquired) return null;
  return async () => {
    try {
      await db.execute(sql`SELECT pg_advisory_unlock(${key}::bigint)`);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "failed to release email-worker advisory lock");
    }
  };
}

/**
 * Postmark ErrorCodes we treat as permanent (no retry). See
 * https://postmarkapp.com/developer/api/overview#error-codes — the typical
 * "inactive recipient" / "invalid email" family is in the 400s.
 */
const PERMANENT_POSTMARK_ERROR_CODES = new Set<number>([
  300, // Invalid email request
  400, // Invalid JSON
  405, // Account is pending review
  406, // Inactive recipient
  409, // JSON error
  412, // Account inactive
  413, // Message too large
  422, // Invalid template
  501, // Template not found
]);

function isPermanentError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "number" && PERMANENT_POSTMARK_ERROR_CODES.has(code)) return true;
  const status = (err as { statusCode?: unknown }).statusCode;
  if (typeof status === "number" && status >= 400 && status < 500 && status !== 429) return true;
  return false;
}

async function deliverOne(row: ReservedEmailRow): Promise<{ messageId: string }> {
  if (row.send_kind === "template") {
    const r = await _sendTemplateEmailDirect({
      to: row.to_email,
      templateAlias: row.template_alias ?? "",
      templateModel: (row.template_model ?? {}) as Record<string, unknown>,
      tag: row.tag ?? undefined,
    });
    return { messageId: r.messageId };
  }
  const r = await _sendEmailDirect({
    to: row.to_email,
    subject: row.subject ?? "",
    htmlBody: row.html_body ?? undefined,
    textBody: row.text_body ?? undefined,
    tag: row.tag ?? undefined,
    replyTo: row.reply_to ?? undefined,
    metadata: (row.metadata ?? undefined) as Record<string, string> | undefined,
  });
  return { messageId: r.messageId };
}

export async function runEmailOutboxDrainOnce(
  db: DbLike,
  opts: { batchSize?: number; stuckSendingThresholdMs?: number } = {},
): Promise<DrainOutcome> {
  const out: DrainOutcome = {
    reserved: 0,
    sent: 0,
    failed: 0,
    deadLettered: 0,
    recovered: 0,
  };

  if (!isConfigured()) {
    out.notConfigured = true;
    return out;
  }

  const release = await tryAcquireLock(db);
  if (!release) {
    out.notLeader = true;
    return out;
  }

  try {
    out.recovered = await recoverStuckSending(db, opts.stuckSendingThresholdMs);
    const batch = await reservePendingBatch(db, opts.batchSize ?? 50);
    out.reserved = batch.length;

    for (const row of batch) {
      try {
        const { messageId } = await deliverOne(row);
        await markSent(db, row.id, messageId);
        out.sent++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const permanent = isPermanentError(err);
        const { terminal } = await markFailure(db, {
          id: row.id,
          attempt: row.attempt,
          maxAttempts: row.max_attempts,
          error: message,
          permanent,
        });
        if (terminal) {
          out.deadLettered++;
          logger.error(
            { id: row.id, to: row.to_email, error: message, permanent },
            "email moved to dead_letter",
          );
        } else {
          out.failed++;
          logger.warn(
            { id: row.id, to: row.to_email, attempt: row.attempt + 1, error: message },
            "email send failed, will retry",
          );
        }
      }
    }
  } finally {
    await release();
  }

  return out;
}

export interface EmailWorkerHandle {
  stop(): Promise<void>;
  triggerOnce(): Promise<DrainOutcome>;
}

export function startEmailOutboxWorker(
  db: DbLike,
  opts: EmailWorkerOptions = {},
): EmailWorkerHandle {
  const tickIntervalMs = opts.tickIntervalMs ?? 15_000;
  const batchSize = opts.batchSize ?? 50;
  const stuckSendingThresholdMs = opts.stuckSendingThresholdMs ?? 5 * 60_000;
  const drainOnce =
    opts.drainOnce ?? ((d) => runEmailOutboxDrainOnce(d, { batchSize, stuckSendingThresholdMs }));

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight: Promise<unknown> | null = null;

  async function tick(): Promise<DrainOutcome> {
    if (stopped) return { reserved: 0, sent: 0, failed: 0, deadLettered: 0, recovered: 0 };
    try {
      const outcome = await drainOnce(db);
      if (outcome.reserved > 0 || outcome.recovered > 0) {
        logger.info(
          {
            reserved: outcome.reserved,
            sent: outcome.sent,
            failed: outcome.failed,
            deadLettered: outcome.deadLettered,
            recovered: outcome.recovered,
          },
          "email-outbox drain tick",
        );
      }
      return outcome;
    } catch (err) {
      logger.error({ err: (err as Error).message }, "email-outbox drain tick crashed");
      return { reserved: 0, sent: 0, failed: 0, deadLettered: 0, recovered: 0 };
    }
  }

  function scheduleNext() {
    if (stopped) return;
    timer = setTimeout(async () => {
      inflight = tick().finally(() => {
        inflight = null;
        scheduleNext();
      });
    }, tickIntervalMs);
    if (typeof (timer as { unref?: () => void }).unref === "function") {
      (timer as unknown as { unref: () => void }).unref();
    }
  }

  // Kick off the first tick a few seconds after boot so dev iterations see
  // queued mail flow quickly.
  timer = setTimeout(
    () => {
      inflight = tick().finally(() => {
        inflight = null;
        scheduleNext();
      });
    },
    Math.min(2_000, tickIntervalMs),
  );
  if (typeof (timer as { unref?: () => void }).unref === "function") {
    (timer as unknown as { unref: () => void }).unref();
  }

  return {
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
      if (inflight) {
        try {
          await inflight;
        } catch {
          /* already logged */
        }
      }
    },
    async triggerOnce() {
      return tick();
    },
  };
}
