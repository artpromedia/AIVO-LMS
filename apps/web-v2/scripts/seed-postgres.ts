/**
 * CLI: seed a Postgres database with the same reference + demo data as
 * memory mode. Run once against a fresh DB before flipping a domain to
 * AIVO_PERSISTENCE_*=postgres.
 *
 *   AIVO_SEED_DATABASE_URL=postgres://… pnpm --filter @aivo/web-v2 db:seed:postgres
 */
import { createDb } from "@aivo/db";
import { seedPostgres } from "@/lib/db/persistence/seed-postgres";

const url = process.env.AIVO_SEED_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("[db:seed:postgres] set AIVO_SEED_DATABASE_URL (or DATABASE_URL).");
  process.exit(1);
}

seedPostgres(createDb(url))
  .then((r) => {
    console.log("[db:seed:postgres] complete:");
    for (const [k, v] of Object.entries(r.inserted)) console.log(`  ${k}: ${v}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error("[db:seed:postgres] failed:", e);
    process.exit(1);
  });
