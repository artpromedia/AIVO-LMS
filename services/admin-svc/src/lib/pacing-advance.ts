/**
 * Phase 2 cron — weekly pacing advancement.
 *
 * Keeps `learner_pacing_weeks.status` in step with the calendar so the system
 * always knows which week is current and how far each plan has progressed:
 *
 *   - week fully in the past   → "done"
 *   - week containing today    → "active"
 *   - week still in the future → "planned"
 *
 * Idempotent (only changed rows are written) and fleet-safe (runs under the
 * shared SafeCron advisory lock, like the other admin-svc jobs). Scoped to the
 * weeks of `active` pacing plans so archived plans are left frozen.
 *
 * NB: this advances *status* only. Lessons are generated on demand when a
 * learner starts (Today's Mission reads the current pacing week live via
 * `getActiveCurriculumFocus`, Phase 2b), so there is nothing to pre-materialize
 * here for correctness — pre-generating LessonRuns would require a
 * standard→skill mapping that does not exist yet and would create runs that may
 * never be used. See docs/curriculum/weekly-pacing.md.
 */
import { sql } from "drizzle-orm";
import type { JobOutcome } from "@aivo/scheduling";

export type WeekStatus = "planned" | "active" | "done";

/**
 * Pure status rule (shared with the SQL CASE below). ISO `YYYY-MM-DD` strings
 * compare correctly lexicographically, so callers pass plain date strings.
 */
export function computeWeekStatus(weekStart: string, weekEnd: string, today: string): WeekStatus {
  if (weekEnd < today) return "done";
  if (weekStart <= today) return "active";
  return "planned";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Advance every active plan's week statuses to match `today` (default: now).
 * Returns the number of rows whose status actually changed.
 */
export async function runPacingAdvanceOnce(
  db: any,
  today: string = todayIso(),
): Promise<JobOutcome & { updatedRows: number }> {
  const result = (await db.execute(sql`
    UPDATE learner_pacing_weeks AS w
    SET status = c.new_status, updated_at = NOW()
    FROM (
      SELECT w2.id,
        CASE
          WHEN w2.week_end < ${today}::date THEN 'done'
          WHEN w2.week_start <= ${today}::date THEN 'active'
          ELSE 'planned'
        END AS new_status
      FROM learner_pacing_weeks w2
      JOIN learner_pacing_plans p
        ON p.id = w2.pacing_plan_id AND p.status = 'active'
    ) c
    WHERE w.id = c.id AND w.status IS DISTINCT FROM c.new_status
    RETURNING w.id
  `)) as { rows?: Array<{ id: string }> } | Array<{ id: string }>;

  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  const updatedRows = rows.length;
  return { status: "ok", walked: updatedRows, updatedRows };
}
