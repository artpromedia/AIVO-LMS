#!/usr/bin/env tsx
/**
 * Backfill `learners.curriculum_alignment` grade keys (adaptive-learning E2E
 * Sprint 2).
 *
 * Before this sprint nothing wrote `grade_band` / `delivery_level` into
 * curriculum_alignment, so learning-svc generated every learner's lessons at
 * a hardcoded "THIRD" grade. New enrollments and baseline finalizations now
 * write the keys; this script repairs EXISTING learners:
 *
 *   - grade_band     ← existing alignment.grade_band, else learners.grade_level
 *   - delivery_level ← θ-derived placement when the learner has a completed
 *                      baseline (learner_profiles.theta_placement), else the
 *                      enrolled grade band
 *   - the learner's LATEST brain_states row gets the same alignment so
 *     lesson generation picks it up without waiting for a re-clone
 *
 * Learners whose grade cannot be parsed are reported, never defaulted.
 * Idempotent: rows that already carry both keys are skipped (unless
 * --recompute is passed). Run from repo root:
 *
 *   DATABASE_URL=postgres://... pnpm exec tsx scripts/backfill-curriculum-alignment.ts --dry-run
 *   DATABASE_URL=postgres://... pnpm exec tsx scripts/backfill-curriculum-alignment.ts
 */
import { sql } from "drizzle-orm";
import { createDb } from "@aivo/db";
import {
  deliveryLevelFromTheta,
  normalizeGradeBand,
} from "@aivo/scoring";

const DRY_RUN = process.argv.includes("--dry-run");
const RECOMPUTE = process.argv.includes("--recompute");
const BATCH_SIZE = 500;

interface LearnerRow {
  id: string;
  grade_level: string | null;
  curriculum_alignment: Record<string, unknown> | null;
  theta_placement: number | null;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const db = createDb(url);

  let updated = 0;
  let skippedComplete = 0;
  let unresolvable: string[] = [];
  let offset = 0;

  for (;;) {
    const rows = (await db.execute(
      sql`SELECT l.id, l.grade_level, l.curriculum_alignment,
                 lp.theta_placement
            FROM learners l
            LEFT JOIN learner_profiles lp ON lp.learner_id = l.id
           ORDER BY l.created_at, l.id
           LIMIT ${BATCH_SIZE} OFFSET ${offset}`,
    )) as unknown as { rows: LearnerRow[] };
    const batch = rows.rows ?? (rows as unknown as LearnerRow[]);
    if (!batch.length) break;
    offset += batch.length;

    for (const row of batch) {
      const alignment =
        row.curriculum_alignment && typeof row.curriculum_alignment === "object"
          ? { ...row.curriculum_alignment }
          : {};

      const hasBoth =
        typeof alignment.grade_band === "string" && typeof alignment.delivery_level === "string";
      if (hasBoth && !RECOMPUTE) {
        skippedComplete += 1;
        continue;
      }

      const gradeBand =
        normalizeGradeBand(
          typeof alignment.grade_band === "string" ? alignment.grade_band : null,
        ) ?? normalizeGradeBand(row.grade_level);
      if (!gradeBand) {
        unresolvable.push(row.id);
        continue;
      }

      const theta =
        typeof row.theta_placement === "number" && Number.isFinite(row.theta_placement)
          ? row.theta_placement
          : null;
      const deliveryLevel = theta !== null ? deliveryLevelFromTheta(theta, gradeBand) : gradeBand;

      const next = {
        ...alignment,
        grade_band: gradeBand,
        delivery_level: deliveryLevel,
        delivery_level_source: theta !== null ? "baseline_theta" : "enrollment_backfill",
        ...(theta !== null ? { delivery_level_theta: theta } : {}),
        delivery_level_updated_at: new Date().toISOString(),
      };

      if (DRY_RUN) {
        console.log(
          `[dry-run] ${row.id}: grade_band=${gradeBand} delivery_level=${deliveryLevel}` +
            (theta !== null ? ` (theta=${theta})` : " (no baseline)"),
        );
      } else {
        await db.execute(
          sql`UPDATE learners
                 SET curriculum_alignment = ${JSON.stringify(next)}::jsonb,
                     updated_at = NOW()
               WHERE id = ${row.id}`,
        );
        await db.execute(
          sql`UPDATE brain_states
                 SET curriculum_alignment = ${JSON.stringify(next)}::jsonb,
                     updated_at = NOW()
               WHERE id = (SELECT id FROM brain_states
                            WHERE learner_id = ${row.id}
                            ORDER BY version DESC, created_at DESC
                            LIMIT 1)`,
        );
      }
      updated += 1;
    }
  }

  console.log(
    `${DRY_RUN ? "[dry-run] " : ""}backfill-curriculum-alignment: ` +
      `${updated} updated, ${skippedComplete} already complete, ` +
      `${unresolvable.length} unresolvable`,
  );
  if (unresolvable.length) {
    console.log(
      "Learners with no parseable grade (fix grade_level, then re-run):\n  " +
        unresolvable.join("\n  "),
    );
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
