/**
 * Journey-database bootstrap (adaptive-learning E2E Sprint 7, simplified by
 * the journal-unification follow-up).
 *
 * The Drizzle journal now covers EVERY SQL file in packages/db/drizzle —
 * the 16 historically out-of-band migrations (0024–0029, 0033–0036,
 * 0039–0040, 0063, 0067–0069) were journaled in numeric position with
 * timestamps that predate every long-lived environment's migration head,
 * so existing databases skip them and fresh databases get the complete
 * schema from a single journal run.
 *
 * This script is therefore: journal migrate + a loud verification that the
 * journey-critical tables exist. The verification failure mode covers one
 * legacy case: a dev database that ran `db:migrate` BEFORE the unification
 * (its migration head postdates the inserted entries, so the migrator
 * skips them) yet never received the out-of-band files. Those databases
 * should be re-created — repairing schema archaeology in place is exactly
 * the ambiguity the unification removed.
 *
 * Usage: DATABASE_URL=postgres://… pnpm exec tsx tests/integration/journey/setup-db.ts
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const here = path.dirname(fileURLToPath(import.meta.url));
const drizzleDir = path.resolve(here, "../../../packages/db/drizzle");

const REQUIRED_TABLES = [
  // services world
  "tenants",
  "users",
  "learners",
  "learner_profiles",
  "parent_assessments",
  "teacher_assessments",
  "therapist_assessments",
  "caregiver_observations",
  "adaptive_baseline_sessions",
  "baseline_item_audits",
  "lesson_sessions",
  "gradebook_entries",
  "profile_recommendations_v2",
  "parent_in_app_notifications",
  // web world (single mastery store)
  "web_skills",
  "web_skill_masteries",
  "web_mastery_maps",
  "web_review_schedules",
  "web_mastery_snapshots",
];

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[journey:setup-db] DATABASE_URL is required");
    process.exit(1);
  }
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client);

  await migrate(db, { migrationsFolder: drizzleDir });

  const missing: string[] = [];
  for (const table of REQUIRED_TABLES) {
    const [row] = await client`SELECT to_regclass(${table}) AS reg`;
    if (!row?.reg) missing.push(table);
  }
  await client.end({ timeout: 5 });

  if (missing.length > 0) {
    console.error(
      `[journey:setup-db] schema incomplete — missing: ${missing.join(", ")}.\n` +
        "This database predates the migration-journal unification (its " +
        "migration head makes the migrator skip the back-journaled files). " +
        "Re-create the database and run db:migrate again.",
    );
    process.exit(1);
  }
  console.log("[journey:setup-db] schema ready (journal migrate, all required tables verified)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
