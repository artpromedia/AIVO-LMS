/**
 * Sprint 2 — BullMQ adapter for the {@link SyncQueue} port.
 *
 * The retry policy + job model live in `./retry.ts` as pure units so they
 * stay testable; this file is the thin shell that pushes jobs at a real
 * Redis-backed BullMQ queue in production. Tests continue to use
 * `InMemorySyncQueue` from `./retry.ts`.
 *
 * Construction is env-driven so importers don't need to know about Redis:
 * `createBullMqQueueFromEnv()` returns `null` when `REDIS_URL` is unset,
 * letting callers fall back to the in-memory port (dev/dry-run).
 */
import { Queue, Worker, type Job, type ConnectionOptions } from "bullmq";
import IORedis, { type Redis } from "ioredis";
import type { SyncJob, SyncQueue } from "./retry.js";

export interface BullMqQueueOptions {
  /** Queue name; defaults to `integration.sync`. */
  name?: string;
  /** How many successful jobs to retain (BullMQ trims older). */
  keepCompleted?: number;
  /** How many failed jobs to retain. */
  keepFailed?: number;
}

const DEFAULT_NAME = "integration.sync";

export class BullMqSyncQueue implements SyncQueue {
  readonly queue: Queue<SyncJob>;
  private readonly keepCompleted: number;
  private readonly keepFailed: number;

  constructor(connection: ConnectionOptions, opts: BullMqQueueOptions = {}) {
    this.queue = new Queue<SyncJob>(opts.name ?? DEFAULT_NAME, { connection });
    this.keepCompleted = opts.keepCompleted ?? 1000;
    this.keepFailed = opts.keepFailed ?? 5000;
  }

  async enqueue(job: SyncJob, delayMs = 0): Promise<void> {
    // We pin `attempts: 1` because retry/dead-letter is decided by
    // `retryRowJob` in `./retry.ts` — the BullMQ retry machinery would
    // double-count the attempt counter and break the backoff policy.
    await this.queue.add(job.type, job, {
      delay: Math.max(0, Math.floor(delayMs)),
      attempts: 1,
      removeOnComplete: this.keepCompleted,
      removeOnFail: this.keepFailed,
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

/**
 * Build a {@link BullMqSyncQueue} from `REDIS_URL`. Returns `null` when
 * the env is unset so callers can fall back to {@link InMemorySyncQueue}
 * without an `if (process.env.NODE_ENV ...)` ladder.
 */
export function createBullMqQueueFromEnv(opts: BullMqQueueOptions = {}): BullMqSyncQueue | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  // BullMQ requires `maxRetriesPerRequest: null` on the ioredis client.
  const conn: Redis = new IORedis(url, { maxRetriesPerRequest: null });
  return new BullMqSyncQueue(conn, opts);
}

/**
 * Spawn a worker that pulls {@link SyncJob}s off the queue and runs `handler`.
 * Caller owns lifecycle (`await worker.close()` on shutdown).
 */
export function createSyncWorker(
  connection: ConnectionOptions,
  handler: (job: SyncJob) => Promise<void>,
  name: string = DEFAULT_NAME,
): Worker<SyncJob> {
  return new Worker<SyncJob>(name, async (j: Job<SyncJob>) => handler(j.data), {
    connection,
    concurrency: Number(process.env.INTEGRATION_SYNC_CONCURRENCY ?? "4"),
  });
}
