/**
 * Lazy, process-singleton Drizzle client for the postgres-backed
 * persistence adapters. Constructed from `serverEnv.DATABASE_URL` on
 * first use so memory-mode deployments (the default) never open a pool.
 */
import { sql } from "drizzle-orm";
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

/**
 * Run `fn` inside a transaction with the per-connection RLS GUC
 * `app.current_tenant` set (ADR 0002). When the app connects as the
 * non-owner `aivo_app` role, the database enforces tenant isolation on
 * every query in the callback — a missing app-layer `WHERE tenant_id`
 * can no longer leak across tenants. `set_config(..., true)` scopes the
 * setting to the transaction. The `tenantId` is bound as a parameter,
 * never interpolated.
 *
 * Request handlers that have flipped a domain to postgres should wrap
 * their adapter calls in this helper, passing the authenticated
 * session's tenant. Cross-tenant/internal reads use a privileged
 * connection that bypasses RLS instead.
 */
export async function withTenantContext<T>(
  tenantId: string,
  fn: (db: Database) => Promise<T>,
): Promise<T> {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`);
    return fn(tx as unknown as Database);
  });
}
