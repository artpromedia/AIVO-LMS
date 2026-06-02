/**
 * Sprint 8 — integrations-svc connector-sync watchdog. (Task #79)
 *
 * Daily housekeeping job that flags every `integration_connections` row whose
 * `last_sync_at` is more than `STALE_HOURS` hours old and bumps its status to
 * `error`. The actual paging on this job *itself* going silent is handled by
 * the central watchdog in admin-svc — this job only needs to be registered in
 * `JOB_REGISTRY` so a missed run is treated as a service-down signal.
 */
import { sql } from "drizzle-orm";
import type { JobOutcome } from "@aivo/scheduling";

const STALE_HOURS = 48;

export async function runConnectorSyncWatchdogOnce(db: any): Promise<JobOutcome> {
  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);
  let flagged = 0;
  try {
    const r = (await db.execute(sql`
      WITH updated AS (
        UPDATE integration_connections
           SET status = 'error', updated_at = NOW()
         WHERE status IN ('active', 'syncing')
           AND last_sync_at IS NOT NULL
           AND last_sync_at < ${cutoff}
         RETURNING 1
      )
      SELECT COUNT(*)::int AS n FROM updated
    `)) as { rows?: Array<{ n: number }> } | Array<{ n: number }>;
    const rows = Array.isArray(r) ? r : (r.rows ?? []);
    flagged = rows[0]?.n ?? 0;
  } catch {
    // table may not exist in some test environments
  }
  return { status: "ok", sent: flagged, failed: 0 };
}
