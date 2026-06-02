/**
 * Sprint 2 — sync job model + per-record retry policy.
 *
 * The roster pipeline runs as three job types: `sync.full`, `sync.delta`,
 * and `sync.row` (per-record). In production these are BullMQ jobs on a
 * dedicated worker pool; this module defines the job contracts and the
 * exponential-backoff policy as pure, testable units so the queue adapter
 * (BullMQ) is a thin shell and the retry semantics are pinned by tests.
 */

export type SyncJobType = "sync.full" | "sync.delta" | "sync.row";

export interface SyncJob {
  type: SyncJobType;
  tenantId: string;
  connectorId: string;
  /** For sync.row: the entity kind + sourcedId being (re)applied. */
  row?: { kind: string; sourcedId: string };
  attempt: number;
}

export interface BackoffPolicy {
  /** Base delay in ms for attempt 1. */
  baseMs: number;
  /** Multiplier per attempt. */
  factor: number;
  /** Hard ceiling in ms. */
  maxMs: number;
  /** Max attempts before the job is dead-lettered. */
  maxAttempts: number;
  /** Jitter fraction [0,1] applied to the computed delay. */
  jitter: number;
}

export const DEFAULT_BACKOFF: BackoffPolicy = {
  baseMs: 1000,
  factor: 2,
  maxMs: 5 * 60_000,
  maxAttempts: 6,
  jitter: 0.2,
};

/**
 * Compute the delay before the next attempt. `attempt` is 1-based (the
 * delay before retrying after attempt N). Deterministic when `rand` is
 * supplied (tests pass 0.5 for the midpoint).
 */
export function backoffDelayMs(
  attempt: number,
  policy: BackoffPolicy = DEFAULT_BACKOFF,
  rand: () => number = Math.random,
): number {
  const raw = policy.baseMs * policy.factor ** Math.max(0, attempt - 1);
  const capped = Math.min(raw, policy.maxMs);
  // Symmetric jitter around the capped value.
  const delta = capped * policy.jitter;
  const jittered = capped - delta + rand() * 2 * delta;
  return Math.round(Math.max(0, jittered));
}

/** Should a failed job be retried, or dead-lettered? */
export function shouldRetry(attempt: number, policy: BackoffPolicy = DEFAULT_BACKOFF): boolean {
  return attempt < policy.maxAttempts;
}

/**
 * The queue port. The BullMQ adapter implements this in production; tests
 * and dry-runs use an in-memory fake.
 */
export interface SyncQueue {
  enqueue(job: SyncJob, delayMs?: number): Promise<void>;
}

/** In-memory queue for tests / dry-run — records enqueued jobs. */
export class InMemorySyncQueue implements SyncQueue {
  readonly jobs: Array<{ job: SyncJob; delayMs: number }> = [];
  async enqueue(job: SyncJob, delayMs = 0): Promise<void> {
    this.jobs.push({ job, delayMs });
  }
}

/**
 * Re-enqueue a failed row job with backoff, or signal dead-letter. Returns
 * the delay used, or `null` when the job was dead-lettered.
 */
export async function retryRowJob(
  queue: SyncQueue,
  job: SyncJob,
  policy: BackoffPolicy = DEFAULT_BACKOFF,
  rand: () => number = Math.random,
): Promise<number | null> {
  const next = job.attempt + 1;
  if (!shouldRetry(next, policy)) return null;
  const delay = backoffDelayMs(next, policy, rand);
  await queue.enqueue({ ...job, attempt: next }, delay);
  return delay;
}
