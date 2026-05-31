/**
 * Lazy, process-singleton Drizzle client for the postgres-backed
 * persistence adapters. Constructed from `serverEnv.DATABASE_URL` on
 * first use so memory-mode deployments (the default) never open a pool.
 */
import { createDb, type Database } from "@aivo/db";
import { serverEnv } from "@/lib/env";

let cached: Database | null = null;

export function getDb(): Database {
  if (cached) return cached;
  const url = serverEnv.DATABASE_URL;
  if (!url) {
    throw new Error(
      "[persistence.drizzle] DATABASE_URL is required when a domain is set to " +
        "AIVO_PERSISTENCE_*=postgres. Set it, or use the default memory mode.",
    );
  }
  cached = createDb(url);
  return cached;
}

/** Test seam — drop the cached client so a fresh URL is picked up. */
export function __resetDbClient(): void {
  cached = null;
}

/** Test seam — inject a Database (e.g. a throwaway test-container client). */
export function __setDbClient(db: Database): void {
  cached = db;
}
