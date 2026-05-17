/**
 * Sprint 9 (Task #100 / #189) — freshness watchdog discovery store.
 *
 * The freshness watchdog walks `daily_job_runs` and the static
 * `JOB_REGISTRY`; every time it encounters a `job_name` that wasn't
 * previously known to this DB, that name is recorded here so the admin
 * UI can show a stable "first observed at" timestamp.
 *
 * The drizzle-backed factory uses INSERT … ON CONFLICT DO UPDATE so
 * `firstSeenAt` is preserved across observations and `lastSeenAt` is
 * bumped on every call. Tested against a real Postgres in
 * `tests/freshness-discovery.test.ts` (Task #189) — getting the
 * conflict clause subtly wrong (e.g. setting `firstSeenAt = excluded.…`)
 * would silently rewrite history.
 */
import { sql } from "drizzle-orm";
import { freshnessWatchdogDiscoveries, type FreshnessWatchdogDiscovery } from "@aivo/db";

export interface FreshnessWatchdogDiscoveryStore {
  /**
   * Record that `jobName` was observed at `now`. Inserts a row with
   * both timestamps set to `now` if absent, otherwise leaves
   * `firstSeenAt` alone and updates `lastSeenAt`. Returns the row.
   */
  recordSeen(jobName: string, now?: Date): Promise<FreshnessWatchdogDiscovery>;

  /** All known discoveries, ordered by `firstSeenAt` ascending. */
  list(): Promise<FreshnessWatchdogDiscovery[]>;
}

export function makeFreshnessWatchdogDiscoveryStore(
  db: any,
): FreshnessWatchdogDiscoveryStore {
  return {
    async recordSeen(jobName, now = new Date()) {
      const [row] = await db
        .insert(freshnessWatchdogDiscoveries)
        .values({ jobName, firstSeenAt: now, lastSeenAt: now })
        .onConflictDoUpdate({
          target: freshnessWatchdogDiscoveries.jobName,
          // CRITICAL: only bump lastSeenAt. Setting firstSeenAt here
          // would silently rewrite the discovery timestamp on every tick.
          set: { lastSeenAt: now },
        })
        .returning();
      return row as FreshnessWatchdogDiscovery;
    },

    async list() {
      const rows = await db
        .select()
        .from(freshnessWatchdogDiscoveries)
        .orderBy(sql`${freshnessWatchdogDiscoveries.firstSeenAt} ASC`);
      return rows as FreshnessWatchdogDiscovery[];
    },
  };
}

export type { FreshnessWatchdogDiscovery };
