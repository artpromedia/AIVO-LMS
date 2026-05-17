/**
 * Sprint 7 — admin audit log retention. (Task #62 audit-svc retention)
 *
 * Daily job that drops `admin_audit_log` rows older than the retention window.
 * Default 730 days (2 years). The window is overridable per-tenant via the
 * `AUDIT_RETENTION_DAYS` env var; we never delete rows whose retention window
 * is unknown.
 */
import { sql } from "drizzle-orm";
import type { JobOutcome } from "@aivo/scheduling";

const DEFAULT_RETENTION_DAYS = 730;

export async function runAuditRetentionOnce(db: any): Promise<JobOutcome> {
  const days = Number.parseInt(process.env.AUDIT_RETENTION_DAYS ?? "", 10);
  const retentionDays = Number.isFinite(days) && days > 0 ? days : DEFAULT_RETENTION_DAYS;
  // postgres-js 3.4.5 requires ISO strings, not Date objects, for prepared-stmt params (#190).
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const result = (await db.execute(sql`
    WITH deleted AS (
      DELETE FROM admin_audit_log WHERE created_at < ${cutoff} RETURNING 1
    )
    SELECT COUNT(*)::int AS n FROM deleted
  `)) as { rows?: Array<{ n: number }> } | Array<{ n: number }>;
  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  const deleted = rows[0]?.n ?? 0;
  return { status: "ok", sent: deleted, failed: 0 };
}
