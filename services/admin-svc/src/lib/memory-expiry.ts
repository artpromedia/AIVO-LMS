/**
 * Wave E (S12) — tutor-memory expiry purge.
 *
 * Every `tutor_memories` row carries an `expires_at` (180 days from
 * write). This daily job is the retention guarantee behind the consent
 * story: a memory the parent never deleted still disappears on schedule.
 * Fleet-safe via the shared SafeCron advisory lock; bounded per run so a
 * backlog can never produce an unbounded delete.
 */
import { sql } from "drizzle-orm";
import type { JobOutcome } from "@aivo/scheduling";

/** Hard per-run cap — a daily cadence clears any realistic backlog. */
const MAX_DELETES_PER_RUN = 10_000;

export async function runMemoryExpiryOnce(
  db: any,
): Promise<JobOutcome & { deletedRows: number }> {
  const result = (await db.execute(sql`
    WITH doomed AS (
      SELECT id FROM tutor_memories
      WHERE expires_at < now()
      LIMIT ${MAX_DELETES_PER_RUN}
    ),
    deleted AS (
      DELETE FROM tutor_memories
      WHERE id IN (SELECT id FROM doomed)
      RETURNING id
    )
    SELECT count(*)::int AS n FROM deleted
  `)) as { rows?: Array<{ n: number }> } | Array<{ n: number }>;
  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  const deletedRows = rows[0]?.n ?? 0;
  return { status: "ok", deletedRows };
}
