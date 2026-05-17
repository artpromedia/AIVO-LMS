import type { PgOutboxClient } from "./postgres.js";

interface PostgresJsSql {
  unsafe<R = unknown>(sql: string, params?: unknown[]): Promise<R[]> & { execute: () => Promise<R[]> };
}

/**
 * Adapt a postgres-js connection (the kind returned by `postgres(url)`) to the
 * minimal PgOutboxClient interface used by PostgresOpsAlertOutboxStore. We
 * keep the surface tiny so we don't pull a hard dep on postgres-js into the
 * ops-alerts package — services pass their own sql instance in.
 */
export function postgresJsOutboxClient(sql: PostgresJsSql): PgOutboxClient {
  return {
    async query<R = unknown>(text: string, params: unknown[] = []) {
      const rows = (await sql.unsafe<R>(text, params)) as R[];
      return { rows, rowCount: rows.length };
    },
  };
}
