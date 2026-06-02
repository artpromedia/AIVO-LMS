/**
 * Durable email outbox. Every public sendEmail() / sendTemplateEmail() call
 * lands here first; the drain worker (email-worker.ts) is the only thing
 * that talks to Postmark. This gives us at-least-once delivery, exponential
 * backoff on transient errors, a dead-letter state for permanent failures,
 * and a single place for the Postmark webhook to reconcile bounces and
 * complaints.
 *
 * The reserve step uses SELECT ... FOR UPDATE SKIP LOCKED so multiple
 * workers (or replicas) can drain concurrently without seeing the same
 * row twice.
 */
import { sql } from "drizzle-orm";

export type EmailOutboxStatus =
  | "pending"
  | "sending"
  | "sent"
  | "failed"
  | "dead_letter"
  | "bounced"
  | "complained";

export interface EnqueueRawEmailInput {
  kind: "raw";
  to: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  tag?: string;
  replyTo?: string;
  metadata?: Record<string, string>;
  dedupeKey?: string;
  maxAttempts?: number;
  tenantId?: string | null;
}

export interface EnqueueTemplateEmailInput {
  kind: "template";
  to: string;
  templateAlias: string;
  templateModel: Record<string, unknown>;
  tag?: string;
  dedupeKey?: string;
  maxAttempts?: number;
  tenantId?: string | null;
}

export type EnqueueEmailInput = EnqueueRawEmailInput | EnqueueTemplateEmailInput;

export interface EnqueueResult {
  id: string;
  status: "queued" | "duplicate";
}

export interface ReservedEmailRow {
  id: string;
  send_kind: "raw" | "template";
  to_email: string;
  subject: string | null;
  html_body: string | null;
  text_body: string | null;
  template_alias: string | null;
  template_model: Record<string, unknown> | null;
  tag: string | null;
  reply_to: string | null;
  metadata: Record<string, string> | null;
  attempt: number;
  max_attempts: number;
}

interface ExecuteCapableDb {
  execute: (q: ReturnType<typeof sql>) => Promise<unknown>;
}

function unwrapRows<R = Record<string, unknown>>(result: unknown): R[] {
  if (Array.isArray(result)) return result as R[];
  if (result && typeof result === "object" && "rows" in (result as Record<string, unknown>)) {
    return ((result as { rows?: R[] }).rows ?? []) as R[];
  }
  return [];
}

/**
 * Exponential backoff with full jitter. Schedule (no jitter):
 *   attempt 1 -> 1m   attempt 2 -> 5m   attempt 3 -> 25m
 *   attempt 4 -> 2h   attempt 5 -> 10h  attempt 6 (default cap) -> 50h
 */
export function computeNextRetryDelayMs(attempt: number, rand: () => number = Math.random): number {
  const base = 60_000; // 1 minute
  const factor = 5;
  const capped = Math.min(attempt, 7);
  const upper = base * Math.pow(factor, capped - 1);
  // Full jitter: [upper/2, upper)
  return Math.floor(upper / 2 + rand() * (upper / 2));
}

export async function enqueueEmail(
  db: ExecuteCapableDb,
  input: EnqueueEmailInput,
): Promise<EnqueueResult> {
  const dedupe = input.dedupeKey ?? null;
  const maxAttempts = input.maxAttempts ?? 6;
  const tenantId = input.tenantId ?? null;

  const sendKind = input.kind;
  const subject = input.kind === "raw" ? input.subject : null;
  const htmlBody = input.kind === "raw" ? (input.htmlBody ?? null) : null;
  const textBody = input.kind === "raw" ? (input.textBody ?? null) : null;
  const templateAlias = input.kind === "template" ? input.templateAlias : null;
  const templateModel =
    input.kind === "template" ? JSON.stringify(input.templateModel ?? {}) : null;
  const tag = input.tag ?? null;
  const replyTo = input.kind === "raw" ? (input.replyTo ?? null) : null;
  const metadata = input.kind === "raw" && input.metadata ? JSON.stringify(input.metadata) : null;

  // ON CONFLICT on the partial unique index over dedupe_key. Returns the
  // existing row's id if there was a duplicate so callers can still surface
  // a stable id to the API consumer.
  const result = await db.execute(sql`
    WITH ins AS (
      INSERT INTO email_outbox (
        dedupe_key, send_kind, to_email, subject, html_body, text_body,
        template_alias, template_model, tag, reply_to, metadata,
        max_attempts, tenant_id
      )
      VALUES (
        ${dedupe}, ${sendKind}, ${input.to}, ${subject}, ${htmlBody}, ${textBody},
        ${templateAlias}, ${templateModel}::jsonb, ${tag}, ${replyTo}, ${metadata}::jsonb,
        ${maxAttempts}, ${tenantId}::uuid
      )
      ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
      RETURNING id
    )
    SELECT id, true AS inserted FROM ins
    UNION ALL
    SELECT id, false AS inserted FROM email_outbox
      WHERE ${dedupe}::text IS NOT NULL AND dedupe_key = ${dedupe}
      LIMIT 1
  `);

  const rows = unwrapRows<{ id: string; inserted: boolean }>(result);
  const row = rows[0];
  if (!row) {
    throw new Error("email-outbox: enqueue returned no row");
  }
  return { id: row.id, status: row.inserted ? "queued" : "duplicate" };
}

/**
 * Reserve up to `limit` rows that are due for sending. Reserved rows are
 * flipped to status='sending' inside the same statement so the worker that
 * lost the race can't pick them up. The query uses SKIP LOCKED so multiple
 * concurrent workers never block each other.
 */
export async function reservePendingBatch(
  db: ExecuteCapableDb,
  limit: number,
): Promise<ReservedEmailRow[]> {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const result = await db.execute(sql`
    WITH picked AS (
      SELECT id FROM email_outbox
      WHERE status IN ('pending', 'failed')
        AND next_retry_at <= now()
      ORDER BY next_retry_at ASC
      LIMIT ${safeLimit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE email_outbox AS e
    SET status = 'sending', updated_at = now()
    FROM picked
    WHERE e.id = picked.id
    RETURNING e.id, e.send_kind, e.to_email, e.subject, e.html_body, e.text_body,
              e.template_alias, e.template_model, e.tag, e.reply_to, e.metadata,
              e.attempt, e.max_attempts
  `);
  return unwrapRows<ReservedEmailRow>(result);
}

export async function markSent(
  db: ExecuteCapableDb,
  id: string,
  providerMessageId: string,
): Promise<void> {
  await db.execute(sql`
    UPDATE email_outbox
    SET status = 'sent',
        provider_message_id = ${providerMessageId},
        sent_at = now(),
        updated_at = now(),
        last_error = NULL
    WHERE id = ${id}::uuid
  `);
}

export interface FailureInput {
  id: string;
  attempt: number;
  maxAttempts: number;
  error: string;
  permanent?: boolean;
  retryDelayMs?: number;
}

/**
 * Record a failure. If `permanent` is true or this attempt exhausted
 * max_attempts, the row moves to dead_letter. Otherwise it goes back to
 * 'failed' with next_retry_at bumped by exponential backoff.
 */
export async function markFailure(
  db: ExecuteCapableDb,
  input: FailureInput,
): Promise<{ terminal: boolean }> {
  const nextAttempt = input.attempt + 1;
  const reachedCap = nextAttempt >= input.maxAttempts;
  const terminal = !!input.permanent || reachedCap;

  if (terminal) {
    await db.execute(sql`
      UPDATE email_outbox
      SET status = 'dead_letter',
          attempt = ${nextAttempt},
          last_error = ${input.error},
          failed_at = now(),
          updated_at = now()
      WHERE id = ${input.id}::uuid
    `);
    return { terminal: true };
  }

  const delayMs = input.retryDelayMs ?? computeNextRetryDelayMs(nextAttempt);
  await db.execute(sql`
    UPDATE email_outbox
    SET status = 'failed',
        attempt = ${nextAttempt},
        last_error = ${input.error},
        next_retry_at = now() + (${delayMs} || ' milliseconds')::interval,
        updated_at = now()
    WHERE id = ${input.id}::uuid
  `);
  return { terminal: false };
}

/**
 * Reconcile a provider webhook event against the outbox row whose
 * provider_message_id matches. Idempotent: replaying the same event is
 * a no-op. Returns the number of rows updated.
 */
export async function recordProviderEvent(
  db: ExecuteCapableDb,
  event: { type: string; messageId: string; recipient?: string; occurredAt?: string },
): Promise<number> {
  if (!event.messageId) return 0;
  const status =
    event.type === "bounced" ? "bounced" : event.type === "complained" ? "complained" : null;
  if (!status) return 0; // delivered/opened/clicked don't change durability state

  const result = await db.execute(sql`
    UPDATE email_outbox
    SET status = ${status},
        last_error = ${`provider webhook: ${event.type}`},
        failed_at = COALESCE(failed_at, now()),
        updated_at = now()
    WHERE provider_message_id = ${event.messageId}
      AND status NOT IN ('bounced', 'complained')
    RETURNING id
  `);
  return unwrapRows(result).length;
}

/** Snapshot used by the admin dashboard / readiness probe. */
export async function getOutboxCounts(
  db: ExecuteCapableDb,
): Promise<Record<EmailOutboxStatus, number>> {
  const result = await db.execute(sql`
    SELECT status, COUNT(*)::int AS n
    FROM email_outbox
    GROUP BY status
  `);
  const rows = unwrapRows<{ status: EmailOutboxStatus; n: number }>(result);
  const counts: Record<EmailOutboxStatus, number> = {
    pending: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    dead_letter: 0,
    bounced: 0,
    complained: 0,
  };
  for (const r of rows) counts[r.status] = r.n;
  return counts;
}

/**
 * Recover rows that have been stuck in 'sending' for longer than the
 * given threshold. This catches the case where a worker crashed mid-send
 * before it could mark the row sent/failed.
 */
export async function recoverStuckSending(
  db: ExecuteCapableDb,
  stuckForMs: number = 5 * 60_000,
): Promise<number> {
  const result = await db.execute(sql`
    UPDATE email_outbox
    SET status = 'pending',
        updated_at = now(),
        last_error = 'recovered from stuck sending'
    WHERE status = 'sending'
      AND updated_at < now() - (${stuckForMs} || ' milliseconds')::interval
    RETURNING id
  `);
  return unwrapRows(result).length;
}
