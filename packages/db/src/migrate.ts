/**
 * CLI entrypoint for `pnpm --filter @aivo/db run db:migrate`.
 *
 * Applies any pending Drizzle migrations from `packages/db/drizzle` to
 * the database identified by `DATABASE_URL`, then exits. The drizzle
 * migrator records applied migrations in the `__drizzle_migrations`
 * table, so this is safe to re-run; with the early migrations now
 * idempotent (see Task #181), it is also safe against dev DBs that
 * were originally bootstrapped via `db:push`.
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
