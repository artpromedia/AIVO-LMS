/**
 * Journey-database bootstrap (adaptive-learning E2E Sprint 7).
 *
 * The repo's Drizzle journal covers most migrations, but 16 SQL files
 * (0024–0029, 0033–0036, 0039–0040, 0063, 0067–0069) are applied
 * OUT-OF-BAND in real environments (scripts/apply-mig-*.sh). A fresh
 * journal-only database therefore lacks learner_profiles,
 * teacher_assessments, learner_interest_signals, … — tables the adaptive
 * journey exercises.
 *
 * This script produces a complete schema on a FRESH database:
 *   1. drizzle journal migrate (packages/db db:migrate semantics),
 *   2. the unjournaled SQL files in numeric order, tracked in
 *      `__journey_oob_migrations` so re-runs are idempotent,
 *   3. re-assert the guarded 0096 ALTER (it no-ops inside the journal run
 *      when learner_profiles doesn't exist yet).
 *
 * Usage: DATABASE_URL=postgres://… pnpm exec tsx tests/integration/journey/setup-db.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const here = path.dirname(fileURLToPath(import.meta.url));
const drizzleDir = path.resolve(here, "../../../packages/db/drizzle");

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[journey:setup-db] DATABASE_URL is required");
    process.exit(1);
  }
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client);

  // 1. Journaled migrations.
  await migrate(db, { migrationsFolder: drizzleDir });

  // 2. Unjournaled (out-of-band) migrations, in numeric order.
  const journal = JSON.parse(
    readFileSync(path.join(drizzleDir, "meta", "_journal.json"), "utf8"),
  ) as { entries: Array<{ tag: string }> };
  const journaled = new Set(journal.entries.map((e) => e.tag));
  const oob = readdirSync(drizzleDir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.slice(0, -4))
    .filter((tag) => !journaled.has(tag))
    .sort();

  // Tables the adaptive journey actually exercises MUST apply; the rest of
  // the out-of-band set is best-effort (some, like 0033's billing backfill,
  // reference legacy columns that only exist on long-lived environments and
  // can never bootstrap a fresh database).
  const REQUIRED_OOB = new Set([
    "0025_learner_profiles",
    "0026_learner_interest_signals",
    "0028_teacher_assessments_and_caregiver_attrib",
    "0039_baseline_item_audits",
  ]);

  await client.unsafe(
    `CREATE TABLE IF NOT EXISTS __journey_oob_migrations (tag text PRIMARY KEY, applied_at timestamptz DEFAULT now())`,
  );
  for (const tag of oob) {
    const [done] = await client`SELECT 1 FROM __journey_oob_migrations WHERE tag = ${tag}`;
    if (done) continue;
    const sqlText = readFileSync(path.join(drizzleDir, `${tag}.sql`), "utf8");
    try {
      for (const stmt of sqlText.split("--> statement-breakpoint")) {
        const trimmed = stmt.trim();
        if (trimmed) await client.unsafe(trimmed);
      }
      await client`INSERT INTO __journey_oob_migrations (tag) VALUES (${tag})`;
      console.log(`[journey:setup-db] applied out-of-band migration ${tag}`);
    } catch (err) {
      if (REQUIRED_OOB.has(tag)) throw err;
      console.warn(
        `[journey:setup-db] optional out-of-band migration ${tag} skipped: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // 3. The guarded 0096 column now that learner_profiles exists.
  await client.unsafe(
    `ALTER TABLE "learner_profiles" ADD COLUMN IF NOT EXISTS "rebaseline_requested_at" timestamp`,
  );

  await client.end({ timeout: 5 });
  console.log(`[journey:setup-db] schema ready (${oob.length} out-of-band migrations tracked)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
