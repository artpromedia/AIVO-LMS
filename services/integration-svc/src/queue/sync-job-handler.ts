/**
 * Sprint 2 — real BullMQ worker handler for SyncJob.
 *
 * Resolves the connection by (tenantId, connectorId), inserts an
 * `integration_sync_logs` row, and runs the provider-specific sync via
 * `runSyncInBackground` (the same code path the HTTP "trigger sync" route
 * uses). On failure, re-enqueues with exponential backoff via `retryRowJob`
 * or dead-letters when the policy's `maxAttempts` is exhausted.
 *
 * No stubs: this is the production handler the worker pool runs.
 */
import { and, eq } from "drizzle-orm";
import { integrationConnections, integrationSyncLogs } from "@aivo/db";
import { runSyncInBackground } from "../routes/connectors.js";
import {
  retryRowJob,
  DEFAULT_BACKOFF,
  type BackoffPolicy,
  type SyncJob,
  type SyncQueue,
} from "./retry.js";

export interface SyncJobHandlerOptions {
  db: any;
  queue: SyncQueue;
  logger: { info: (msg: any) => void; warn: (msg: any) => void; error: (msg: any) => void };
  /** Override the retry policy (tests). */
  policy?: BackoffPolicy;
}

export function createSyncJobHandler(opts: SyncJobHandlerOptions) {
  const { db, queue, logger } = opts;
  const policy = opts.policy ?? DEFAULT_BACKOFF;

  return async function handle(job: SyncJob): Promise<void> {
    const start = Date.now();
    try {
      // Resolve connection by (tenantId, connectorId). Prefer "active"; otherwise
      // fall back to syncing/error so we can still flip a stuck connector forward.
      const rows = await db
        .select()
        .from(integrationConnections)
        .where(
          and(
            eq(integrationConnections.tenantId, job.tenantId),
            eq(integrationConnections.connectorId, job.connectorId),
          ),
        );
      const connection =
        rows.find((r: any) => r.status === "active") ??
        rows.find((r: any) => r.status === "syncing" || r.status === "error") ??
        rows[0];

      if (!connection) {
        throw new Error(
          `no integration_connection for tenantId=${job.tenantId} connectorId=${job.connectorId}`,
        );
      }

      // Open a sync log row up front so /api/integrations/sync/:id/status sees it
      // while the run is in flight. runSyncInBackground writes the terminal status.
      const [syncLog] = await db
        .insert(integrationSyncLogs)
        .values({
          connectionId: connection.id,
          syncType: job.type,
          status: "running",
          details: {
            queueJob: true,
            attempt: job.attempt,
            ...(job.row ? { row: job.row } : {}),
          },
        })
        .returning();

      logger.info({
        msg: "sync job started",
        type: job.type,
        tenantId: job.tenantId,
        connectorId: job.connectorId,
        attempt: job.attempt,
        syncLogId: syncLog.id,
      });

      await runSyncInBackground(db, connection, syncLog.id);

      logger.info({
        msg: "sync job done",
        type: job.type,
        tenantId: job.tenantId,
        connectorId: job.connectorId,
        durationMs: Date.now() - start,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Exponential-backoff re-enqueue (or dead-letter). BullMQ attempts is pinned
      // to 1 in bullmq-adapter; the retry policy lives here in app code so jitter
      // and dead-lettering are deterministic and unit-testable.
      const delay = await retryRowJob(queue, job, policy).catch(() => null);
      if (delay === null) {
        logger.error({
          msg: "sync job dead-lettered",
          type: job.type,
          tenantId: job.tenantId,
          connectorId: job.connectorId,
          attempt: job.attempt,
          error: message,
        });
      } else {
        logger.warn({
          msg: "sync job retried",
          type: job.type,
          tenantId: job.tenantId,
          connectorId: job.connectorId,
          attempt: job.attempt,
          nextDelayMs: delay,
          error: message,
        });
      }
      // Intentionally do not rethrow: BullMQ would mark the job failed with no
      // further attempts (attempts:1). Our retry contract is "re-enqueue a new
      // copy with attempt+1", which is exactly what retryRowJob just did.
    }
  };
}
