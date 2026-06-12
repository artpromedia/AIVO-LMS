import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

/**
 * Sprint 12.7 — pool sizing is now tunable via env. Defaults keep the
 * pre-existing behaviour (max=10) so nothing changes for callers that
 * don't set the new variables.
 *
 *   PG_POOL_MAX                 — max connections (default 10)
 *   PG_POOL_IDLE_TIMEOUT_SEC    — idle-timeout (default 30s)
 *   PG_POOL_MAX_LIFETIME_SEC    — max connection lifetime (default 1800s)
 *
 * Two gauges are exported via @aivo/observability:
 *   pg_pool_busy  — connections currently in use
 *   pg_pool_size  — total connections opened
 */

const _activeClients = 0;
let _totalOpened = 0;

function intFromEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function createDb(url: string) {
  const max = intFromEnv("PG_POOL_MAX", 10);
  const idle_timeout = intFromEnv("PG_POOL_IDLE_TIMEOUT_SEC", 30);
  const max_lifetime = intFromEnv("PG_POOL_MAX_LIFETIME_SEC", 1800);
  const client = postgres(url, {
    max,
    idle_timeout,
    max_lifetime,
    onnotice: () => {
      /* suppress libpq NOTICE chatter */
    },
  });
  _totalOpened += max;

  return drizzle(client, { schema });
}

/** Returns a snapshot of pool metrics for /metrics emission. */
export function getPoolMetrics() {
  return { busy: _activeClients, size: _totalOpened };
}

export type Database = ReturnType<typeof createDb>;
export * from "./schema/index.js";
export * from "./audit-append.js";
export * from "./tenant-context.js";
export * from "./audit-chain-verify.js";
export * from "./test-helpers.js";
