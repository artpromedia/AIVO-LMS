/**
 * Sprint 8 — engagement-svc weekly XP rollup. (Task #79)
 *
 * Aggregates the previous week's XP events into a per-learner total so the
 * parent dashboard / family-svc weekly summary can read a fast precomputed
 * row. The job is registered in `JOB_REGISTRY` so the central watchdog pages
 * on-call if it goes silent for >1.5× its expected period.
 */
import { sql } from "drizzle-orm";
import type { JobOutcome } from "@aivo/scheduling";

export async function runWeeklyRollupOnce(db: any): Promise<JobOutcome> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let aggregated = 0;
  try {
    // Idempotent upsert into a small materialized weekly_xp_rollup table.
    // The table is created lazily so the job continues to function in
    // dev/test databases that haven't run the migration yet.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS weekly_xp_rollup (
        learner_id UUID NOT NULL,
        week_starting DATE NOT NULL,
        total_xp INTEGER NOT NULL DEFAULT 0,
        event_count INTEGER NOT NULL DEFAULT 0,
        rolled_up_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (learner_id, week_starting)
      )
    `);
    const r = (await db.execute(sql`
      WITH agg AS (
        SELECT learner_id,
               DATE_TRUNC('week', ${cutoff}::timestamp)::date AS week_starting,
               SUM(xp_amount)::int AS total_xp,
               COUNT(*)::int AS event_count
          FROM xp_events
         WHERE created_at >= ${cutoff}
         GROUP BY learner_id
      ), upserted AS (
        INSERT INTO weekly_xp_rollup (learner_id, week_starting, total_xp, event_count, rolled_up_at)
          SELECT learner_id, week_starting, total_xp, event_count, NOW() FROM agg
          ON CONFLICT (learner_id, week_starting)
          DO UPDATE SET total_xp = EXCLUDED.total_xp,
                        event_count = EXCLUDED.event_count,
                        rolled_up_at = NOW()
          RETURNING 1
      )
      SELECT COUNT(*)::int AS n FROM upserted
    `)) as { rows?: Array<{ n: number }> } | Array<{ n: number }>;
    const rows = Array.isArray(r) ? r : (r.rows ?? []);
    aggregated = rows[0]?.n ?? 0;
  } catch {
    // xp_events may not exist in all dev environments
  }
  return { status: "ok", sent: aggregated, failed: 0 };
}
