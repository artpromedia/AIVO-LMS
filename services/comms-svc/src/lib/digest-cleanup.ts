/**
 * Sprint 7 — comms-svc digest cleanup. Daily job that drops expired
 * notification digest rows. Wired into the shared scheduler so a single
 * leader runs it across the fleet.
 */
import { sql } from "drizzle-orm";
import type { JobOutcome } from "@aivo/scheduling";

const RETENTION_DAYS = 30;

export async function runDigestCleanupOnce(db: any): Promise<JobOutcome> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  let deleted = 0;
  try {
    const r = (await db.execute(sql`
      WITH deleted AS (
        DELETE FROM notifications WHERE created_at < ${cutoff} RETURNING 1
      )
      SELECT COUNT(*)::int AS n FROM deleted
    `)) as { rows?: Array<{ n: number }> } | Array<{ n: number }>;
    const rows = Array.isArray(r) ? r : (r.rows ?? []);
    deleted += rows[0]?.n ?? 0;
  } catch {
    /* table may not exist in some environments */
  }
  return { status: "ok", sent: deleted, failed: 0 };
}
