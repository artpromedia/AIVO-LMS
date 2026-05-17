/**
 * Real Postgres implementation of `LeaderLock` and `JobLedger` using drizzle's
 * `sql` template + the `daily_job_runs` / `periodic_job_runs` tables.
 *
 * Advisory locks are scoped to the *session*, not the transaction — postgres-js
 * pins a single connection per call, so we acquire and release on the same
 * underlying connection. We hash the job name to a 64-bit integer so callers
 * don't have to maintain a registry of stable lock numbers.
 */
import { sql } from "drizzle-orm";
import { dailyJobRuns, periodicJobRuns } from "@aivo/db";
import type { JobLedger, LeaderLock } from "./index.js";

export type DrizzleLikeDb = {
  execute: (q: ReturnType<typeof sql>) => Promise<unknown>;
  insert: (table: typeof dailyJobRuns | typeof periodicJobRuns) => {
    values: (v: Record<string, unknown>) => {
      onConflictDoUpdate?: (cfg: {
        target: unknown;
        set: Record<string, unknown>;
      }) => Promise<unknown>;
      onConflictDoNothing?: () => Promise<unknown>;
    } & Promise<unknown>;
  };
};

/** Hash a string to a signed 64-bit integer suitable for `pg_advisory_lock`. */
export function hashJobNameToLockKey(jobName: string): bigint {
  // FNV-1a 64-bit
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < jobName.length; i++) {
    hash ^= BigInt(jobName.charCodeAt(i));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  // pg expects a signed bigint; convert by reinterpreting the high bit.
  if (hash >= 0x8000000000000000n) hash -= 0x10000000000000000n;
  return hash;
}

export function createDrizzleAdvisoryLock(db: DrizzleLikeDb): LeaderLock {
  return {
    async tryAcquire(jobName: string) {
      const key = hashJobNameToLockKey(jobName);
      const result = (await db.execute(
        sql`SELECT pg_try_advisory_lock(${key}::bigint) AS acquired`,
      )) as { rows?: Array<{ acquired: boolean }> } | Array<{ acquired: boolean }>;
      const rows = Array.isArray(result) ? result : (result.rows ?? []);
      const acquired = rows[0]?.acquired === true;
      if (!acquired) return null;
      return async () => {
        await db.execute(sql`SELECT pg_advisory_unlock(${key}::bigint)`);
      };
    },
  };
}

export function createDrizzleLedger(
  db: DrizzleLikeDb,
  opts: { historyLimitPerJob?: number } = {},
): JobLedger {
  const limit = opts.historyLimitPerJob ?? 50;
  return {
    async getLastRunAt(jobName) {
      const result = (await db.execute(
        sql`SELECT last_run_at FROM daily_job_runs WHERE job_name = ${jobName}`,
      )) as { rows?: Array<{ last_run_at: string | Date }> } | Array<{ last_run_at: string | Date }>;
      const rows = Array.isArray(result) ? result : (result.rows ?? []);
      const v = rows[0]?.last_run_at;
      if (!v) return null;
      return v instanceof Date ? v : new Date(v);
    },

    async markStarted({ jobName, runAt, replicaId }) {
      // postgres-js 3.4.5 rejects Date params; pass ISO strings (#190).
      const runAtIso = runAt instanceof Date ? runAt.toISOString() : runAt;
      await db.execute(sql`
        INSERT INTO daily_job_runs (job_name, last_run_at, last_replica_id, last_status, updated_at)
        VALUES (${jobName}, ${runAtIso}, ${replicaId}, 'running', NOW())
        ON CONFLICT (job_name) DO UPDATE SET
          last_run_at = EXCLUDED.last_run_at,
          last_replica_id = EXCLUDED.last_replica_id,
          last_status = 'running',
          last_finished_at = NULL,
          last_sent = NULL,
          last_failed = NULL,
          last_error = NULL,
          updated_at = NOW()
      `);
    },

    async markFinished({ jobName, finishedAt, status, sent, failed, error }) {
      const finishedAtIso = finishedAt instanceof Date ? finishedAt.toISOString() : finishedAt;
      await db.execute(sql`
        UPDATE daily_job_runs
        SET last_finished_at = ${finishedAtIso},
            last_status = ${status},
            last_sent = ${sent ?? null},
            last_failed = ${failed ?? null},
            last_error = ${error ?? null},
            updated_at = NOW()
        WHERE job_name = ${jobName}
      `);
    },

    async appendHistory({ jobName, runAt, finishedAt, replicaId, status, durationMs, error }) {
      const runAtIso = runAt instanceof Date ? runAt.toISOString() : runAt;
      const finishedAtIso = finishedAt instanceof Date ? finishedAt.toISOString() : finishedAt;
      await db.execute(sql`
        INSERT INTO periodic_job_runs (job_name, run_at, finished_at, replica_id, status, duration_ms, error)
        VALUES (${jobName}, ${runAtIso}, ${finishedAtIso}, ${replicaId}, ${status}, ${durationMs}, ${error ?? null})
      `);
      // Best-effort prune so the history table stays bounded.
      try {
        await db.execute(sql`
          DELETE FROM periodic_job_runs
          WHERE job_name = ${jobName}
            AND id NOT IN (
              SELECT id FROM periodic_job_runs
              WHERE job_name = ${jobName}
              ORDER BY run_at DESC
              LIMIT ${limit}
            )
        `);
      } catch {
        /* swallowed: a backup janitor (Task #178) handles unbounded growth. */
      }
    },
  };
}
