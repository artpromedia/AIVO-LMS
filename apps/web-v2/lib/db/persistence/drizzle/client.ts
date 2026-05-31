import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";
import { createDb, type Database } from "@aivo/db";
import { serverEnv } from "@/lib/env";

let cached: Database | null = null;

/**
 * Request-scoped tenant transaction. When set, `getDb()` returns the
 * tenant-scoped transaction instead of the shared pool, so every
 * persistence adapter call made inside `withTenantContext` runs under
 * the RLS GUC — without changing any adapter signature.
 */
const tenantTx = new AsyncLocalStorage<{ db: Database }>();

/** The shared, process-singleton pool (no tenant scope). */
function baseDb(): Database {
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

/**
 * The active database handle: the tenant-scoped transaction if one is
 * open (via `withTenantContext`), otherwise the shared pool.
 */
export function getDb(): Database {
  return tenantTx.getStore()?.db ?? baseDb();
}

/** Whether a Postgres connection is configured at all (else memory mode). */
function hasDb(): boolean {
  return cached != null || Boolean(serverEnv.DATABASE_URL);
}

/** Test seam — drop the cached client so a fresh URL is picked up. */
export function __resetDbClient(): void {
  cached = null;
}

/** Test seam — inject a Database (e.g. a throwaway test-container client). */
export function __setDbClient(db: Database): void {
  cached = db;
}

/**
 * Run `fn` with tenant isolation in effect (ADR 0002).
 *
 * Opens a transaction, sets the per-connection RLS GUC
 * `app.current_tenant` (bound parameter, never interpolated), and runs
 * `fn` inside an AsyncLocalStorage scope so any `getDb()` call — and
 * therefore any persistence adapter — uses that transaction. When the
 * app connects as the non-owner `aivo_app` role the database enforces
 * tenant isolation on every query; a missing app-layer `WHERE tenant_id`
 * can no longer leak across tenants. `set_config(..., true)` scopes the
 * setting to the transaction (fail-closed: no tenant ⇒ no rows).
 *
 * In memory mode (no DATABASE_URL) this is a transparent passthrough, so
 * request handlers can wrap their logic unconditionally.
 */
export async function withTenantContext<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  if (!hasDb()) return fn();
  return baseDb().transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`);
    return tenantTx.run({ db: tx as unknown as Database }, fn);
  });
}
