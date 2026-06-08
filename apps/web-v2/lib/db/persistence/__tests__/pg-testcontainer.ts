/**
 * Testcontainers helper — a real, throwaway Postgres for the persistence
 * parity suite (Sprint 0). No mocks, no in-memory fakes: this boots an
 * actual `postgres:16` container, applies the full `@aivo/db` migration
 * set against it, points the drizzle client at it via `__setDbClient`,
 * and tears everything down afterwards.
 *
 * Two ways in:
 *
 *   - `startPostgres()` — lifecycle form for `beforeAll`/`afterAll`. Returns
 *     `null` when no Postgres is reachable (Docker absent and no
 *     `AIVO_TEST_DATABASE_URL`), so a suite can `it.skip` instead of failing
 *     on a machine without Docker. Mirrors the skip-when-no-DB convention in
 *     `stores.postgres.contract.test.ts`.
 *   - `withPostgres(fn)` — closure form. Brings a container up, runs `fn`
 *     with `AIVO_PERSISTENCE=postgres` in effect, then tears down.
 *
 * When `AIVO_TEST_DATABASE_URL` is set (CI provisions a Postgres service
 * container) that URL is used directly and no testcontainer is started —
 * the migration step is idempotent, so this is safe to share across files.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { createDb, closeDb, type Database } from "@aivo/db";
import { __resetDbClient, __setDbClient } from "../drizzle/client";

export interface PostgresHandle {
  /** The migrated drizzle client, also installed as the global client. */
  db: Database;
  /** The connection URL (testcontainer or AIVO_TEST_DATABASE_URL). */
  url: string;
  /** Stop the container (if any), reset the client, restore env. */
  teardown: () => Promise<void>;
}

const POSTGRES_IMAGE = "postgres:16";

// The web-domain migration subset that creates every table the adapters
// touch. Applied directly (not via stateful drizzle migrate) so the schema
// is reset to a known-complete state regardless of what a sibling test file
// did to the shared CI Postgres — mirrors stores.postgres.contract.test.ts.
const migrationsDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../packages/db/drizzle",
);
const WEB_SCHEMA_MIGRATIONS = [
  "0047_lesson_runs",
  "0048_learner_brain_profiles",
  "0049_web_domain",
  "0072_web_collaboration",
];

/** Reset `public` and apply the web-domain schema (hermetic, idempotent). */
async function applyWebSchema(db: Database): Promise<void> {
  await db.execute(sql.raw("DROP SCHEMA IF EXISTS public CASCADE"));
  await db.execute(sql.raw("CREATE SCHEMA public"));
  for (const name of WEB_SCHEMA_MIGRATIONS) {
    const file = readFileSync(resolve(migrationsDir, `${name}.sql`), "utf8");
    for (const stmt of file.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed) await db.execute(sql.raw(trimmed));
    }
  }
}

interface ResolvedUrl {
  url: string;
  stopContainer?: () => Promise<void>;
}

/**
 * Resolve a Postgres URL: an externally provisioned one
 * (`AIVO_TEST_DATABASE_URL`) if present, otherwise a fresh testcontainer.
 * Returns `null` when neither is available so callers can skip cleanly.
 */
async function resolveUrl(): Promise<ResolvedUrl | null> {
  if (process.env.AIVO_TEST_DATABASE_URL) {
    return { url: process.env.AIVO_TEST_DATABASE_URL };
  }
  try {
    // Imported lazily: `@testcontainers/postgresql` is a dev-only dep that
    // needs a reachable Docker daemon. If the import or `start()` fails
    // (no Docker), we fall back to "no DB available" rather than crashing
    // the whole suite.
    const { PostgreSqlContainer } = await import("@testcontainers/postgresql");
    const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    return {
      url: container.getConnectionUri(),
      stopContainer: async () => {
        await container.stop();
      },
    };
  } catch {
    return null;
  }
}

/**
 * Bring up (or attach to) a migrated Postgres and install it as the active
 * drizzle client. Returns `null` when no Postgres is reachable.
 */
export async function startPostgres(): Promise<PostgresHandle | null> {
  const resolved = await resolveUrl();
  if (!resolved) return null;

  const prevPersistence = process.env.AIVO_PERSISTENCE;
  process.env.AIVO_PERSISTENCE = "postgres";

  const db = createDb(resolved.url);
  await applyWebSchema(db);
  __setDbClient(db);

  return {
    db,
    url: resolved.url,
    teardown: async () => {
      __resetDbClient();
      await closeDb(db);
      if (resolved.stopContainer) await resolved.stopContainer();
      if (prevPersistence === undefined) delete process.env.AIVO_PERSISTENCE;
      else process.env.AIVO_PERSISTENCE = prevPersistence;
    },
  };
}

/**
 * Closure form: run `fn` against a real, migrated Postgres with
 * `AIVO_PERSISTENCE=postgres` in effect, tearing the container down after.
 * Throws if no Postgres is reachable — use `startPostgres()` (and skip)
 * when running on Docker-less machines is expected.
 */
export async function withPostgres<T>(fn: (db: Database) => Promise<T>): Promise<T> {
  const handle = await startPostgres();
  if (!handle) {
    throw new Error(
      "[withPostgres] no Postgres available — start Docker or set " +
        "AIVO_TEST_DATABASE_URL. (startPostgres() returns null so callers " +
        "that prefer to skip can do so.)",
    );
  }
  try {
    return await fn(handle.db);
  } finally {
    await handle.teardown();
  }
}
