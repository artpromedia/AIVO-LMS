/**
 * CLI entrypoint for `pnpm --filter @aivo/db run db:migrate`.
 *
 * Applies any pending Drizzle migrations from `packages/db/drizzle` to
 * the database identified by `DATABASE_URL`, then exits. The drizzle
 * migrator records applied migrations in the `__drizzle_migrations`
 * table, so this is safe to re-run; with the early migrations now
 * idempotent (see Task #181), it is also safe against dev DBs that
 * were originally bootstrapped via `db:push`.
 *
 * Journal unification (adaptive-learning E2E follow-up): the journal now
 * covers EVERY SQL file in `drizzle/` — the 16 migrations historically
 * applied out-of-band via `scripts/apply-mig-*.sh` (0024–0029, 0033–0036,
 * 0039–0040, 0063, 0067–0069) are back-journaled in numeric position with
 * `when` timestamps that PREDATE every long-lived environment's migration
 * head. Consequences:
 *   - fresh databases get the complete schema from this one command;
 *   - long-lived environments (which already received those files
 *     out-of-band) skip them, because the migrator only applies entries
 *     newer than the max recorded created_at;
 *   - a dev database migrated journal-only BEFORE the unification will
 *     also skip them and stay incomplete — re-create it (the journey
 *     setup, tests/integration/journey/setup-db.ts, detects and reports
 *     this case loudly).
 * The 0033/0034 files are guarded so their legacy-column statements
 * (plan_id backfill, persona_id constraint relaxation) no-op on fresh
 * databases. New migrations MUST be journaled — never applied out-of-band.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Don't crash CI/test pipelines that legitimately have no DB; just
    // emit a clear message and exit 0.
    console.warn("[db:migrate] DATABASE_URL is not set; skipping.");
    return;
  }
  // A short-lived dedicated client so we can close it on completion and
  // let the script exit instead of hanging on an open pool.
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = path.resolve(here, "..", "drizzle");
  try {
    await migrate(db, { migrationsFolder });
    console.log("[db:migrate] migrations applied (or already up-to-date).");
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[db:migrate] failed:", err);
  process.exit(1);
});
