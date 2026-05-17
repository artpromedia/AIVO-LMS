/**
 * Sprint 7 — run-history janitor. (Tasks #72, #178)
 *
 * Defense-in-depth backstop for the per-tick prune in the schedulers. If a
 * tick's prune ever silently fails — or a job is renamed/removed and leaves
 * orphan rows — this daily janitor keeps `periodic_job_runs` and
 * `billing_daily_job_runs` bounded.
 *
 * Strategy:
 *   1. For each job_name present in the table, keep the latest N rows
 *      (50 for periodic_job_runs, 30 for billing_daily_job_runs).
 *   2. Drop rows older than the global retention window (default 90 days)
 *      regardless of how the per-job count looks; this catches orphans.
 */
import { sql } from "drizzle-orm";
import { JOB_REGISTRY, type JobOutcome } from "@aivo/scheduling";
import { sweepOrphanedDiscoveries } from "../routes/jobs.js";

const PERIODIC_LIMIT = 50;
const BILLING_LIMIT = 30;
const ORPHAN_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
// Discovery rows for jobs no longer in JOB_REGISTRY and last observed more
// than this long ago are dropped automatically (#188).
const DISCOVERY_STALE_MS = 30 * 24 * 60 * 60 * 1000;

export async function runJanitorOnce(db: any): Promise<JobOutcome & { deletedRows: number }> {
  let deleted = 0;

  // Per-job prune for periodic_job_runs
  const namesResult = (await db.execute(sql`
    SELECT DISTINCT job_name FROM periodic_job_runs
  `)) as { rows?: Array<{ job_name: string }> } | Array<{ job_name: string }>;
  const periodicNames = (Array.isArray(namesResult) ? namesResult : (namesResult.rows ?? []))
    .map((r) => r.job_name);

  for (const jobName of periodicNames) {
    const result = (await db.execute(sql`
      WITH deleted AS (
        DELETE FROM periodic_job_runs
        WHERE job_name = ${jobName}
          AND id NOT IN (
            SELECT id FROM periodic_job_runs
            WHERE job_name = ${jobName}
            ORDER BY run_at DESC
            LIMIT ${PERIODIC_LIMIT}
          )
        RETURNING 1
      )
      SELECT COUNT(*)::int AS n FROM deleted
    `)) as { rows?: Array<{ n: number }> } | Array<{ n: number }>;
    const rows = Array.isArray(result) ? result : (result.rows ?? []);
    deleted += rows[0]?.n ?? 0;
  }

  // Per-job prune for billing_daily_job_runs
  const billingNamesResult = (await db.execute(sql`
    SELECT DISTINCT job_name FROM billing_daily_job_runs
  `)) as { rows?: Array<{ job_name: string }> } | Array<{ job_name: string }>;
  const billingNames = (Array.isArray(billingNamesResult)
    ? billingNamesResult
    : (billingNamesResult.rows ?? [])
  ).map((r) => r.job_name);
  for (const jobName of billingNames) {
    const result = (await db.execute(sql`
      WITH deleted AS (
        DELETE FROM billing_daily_job_runs
        WHERE job_name = ${jobName}
          AND id NOT IN (
            SELECT id FROM billing_daily_job_runs
            WHERE job_name = ${jobName}
            ORDER BY run_at DESC
            LIMIT ${BILLING_LIMIT}
          )
        RETURNING 1
      )
      SELECT COUNT(*)::int AS n FROM deleted
    `)) as { rows?: Array<{ n: number }> } | Array<{ n: number }>;
    const rows = Array.isArray(result) ? result : (result.rows ?? []);
    deleted += rows[0]?.n ?? 0;
  }

  // Orphan sweep — anything older than the retention window is dropped, full stop.
  // postgres-js 3.4.5 requires ISO strings, not Date objects, for prepared-stmt params (#190).
  const orphanCutoff = new Date(Date.now() - ORPHAN_WINDOW_MS).toISOString();
  const orphan1 = (await db.execute(sql`
    WITH deleted AS (
      DELETE FROM periodic_job_runs WHERE run_at < ${orphanCutoff} RETURNING 1
    )
    SELECT COUNT(*)::int AS n FROM deleted
  `)) as { rows?: Array<{ n: number }> } | Array<{ n: number }>;
  const orphan1Rows = Array.isArray(orphan1) ? orphan1 : (orphan1.rows ?? []);
  deleted += orphan1Rows[0]?.n ?? 0;

  const orphan2 = (await db.execute(sql`
    WITH deleted AS (
      DELETE FROM billing_daily_job_runs WHERE run_at < ${orphanCutoff} RETURNING 1
    )
    SELECT COUNT(*)::int AS n FROM deleted
  `)) as { rows?: Array<{ n: number }> } | Array<{ n: number }>;
  const orphan2Rows = Array.isArray(orphan2) ? orphan2 : (orphan2.rows ?? []);
  deleted += orphan2Rows[0]?.n ?? 0;

  // Sweep orphan rows from the watchdog discovery registry — services that
  // used to host a job but no longer report it (#188). This is the
  // automated complement to the admin-only DELETE endpoint.
  try {
    const swept = await sweepOrphanedDiscoveries(db, { staleAfterMs: DISCOVERY_STALE_MS });
    deleted += swept.deleted;
  } catch {
    /* best effort; the manual DELETE endpoint is the recovery path */
  }

  // Touch JOB_REGISTRY so the import isn't tree-shaken by aggressive bundlers
  // — ensures this file participates in the registry-vs-ledger reconciliation.
  void JOB_REGISTRY;

  return { status: "ok", sent: deleted, failed: 0, deletedRows: deleted };
}
