import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  text,
  index,
  bigserial,
} from "drizzle-orm/pg-core";

/**
 * Sprint 7 — Background Jobs & Admin Console.
 *
 * `daily_job_runs` is the fleet-wide ledger that lets every replica decide
 * whether the day's tick has already run. Exactly one row per `job_name`.
 * Multiple replicas race on the advisory lock named after the job; whichever
 * acquires it inspects/updates this row inside the locked region.
 */
export const dailyJobRuns = pgTable("daily_job_runs", {
  jobName: varchar("job_name", { length: 100 }).primaryKey(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }).notNull(),
  lastFinishedAt: timestamp("last_finished_at", { withTimezone: true }),
  lastReplicaId: varchar("last_replica_id", { length: 100 }),
  lastStatus: varchar("last_status", { length: 20 }),
  lastSent: integer("last_sent"),
  lastFailed: integer("last_failed"),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Append-only history for the *billing* daily batch (Task #60). Pruned to the
 * last 30 rows per job_name in application code, with a SQL janitor as defense
 * in depth (Task #72).
 */
export const billingDailyJobRuns = pgTable(
  "billing_daily_job_runs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobName: varchar("job_name", { length: 100 }).notNull(),
    runAt: timestamp("run_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    replicaId: varchar("replica_id", { length: 100 }),
    status: varchar("status", { length: 20 }).notNull(),
    sent: integer("sent"),
    failed: integer("failed"),
    durationMs: integer("duration_ms"),
    error: text("error"),
  },
  (t) => [
    index("idx_billing_daily_job_runs_job_run").on(t.jobName, t.runAt),
    index("idx_billing_daily_job_runs_status").on(t.status),
  ],
);

/**
 * Generic append-only history for *every* fleet-wide periodic job (Task #78).
 * Pruned per-job to the last 50 rows on insert; a janitor keeps it bounded
 * even if the inline prune fails (Task #178).
 */
export const periodicJobRuns = pgTable(
  "periodic_job_runs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobName: varchar("job_name", { length: 100 }).notNull(),
    runAt: timestamp("run_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    replicaId: varchar("replica_id", { length: 100 }),
    status: varchar("status", { length: 20 }).notNull(),
    durationMs: integer("duration_ms"),
    error: text("error"),
  },
  (t) => [
    index("idx_periodic_job_runs_job_run").on(t.jobName, t.runAt),
    index("idx_periodic_job_runs_run_at").on(t.runAt),
  ],
);

export type DailyJobRun = typeof dailyJobRuns.$inferSelect;
export type BillingDailyJobRun = typeof billingDailyJobRuns.$inferSelect;
export type PeriodicJobRun = typeof periodicJobRuns.$inferSelect;

/**
 * Sprint 9 — freshness watchdog discovery store (Task #100 / #189).
 *
 * The watchdog is normally driven by the static `JOB_REGISTRY`, but it
 * also encounters job names at runtime — e.g. `daily_job_runs` rows
 * whose `job_name` isn't in the registry. This table is the persisted
 * record of those discoveries so the admin UI can show "first observed
 * at <ts>" without recomputing it from history every page load.
 *
 * Invariants:
 *   - `firstSeenAt` is set on insert and MUST NEVER be overwritten.
 *   - `lastSeenAt` is bumped on every observation via
 *     `onConflictDoUpdate({ target: jobName, set: { lastSeenAt: now } })`.
 */
export const freshnessWatchdogDiscoveries = pgTable(
  "freshness_watchdog_discoveries",
  {
    jobName: varchar("job_name", { length: 100 }).primaryKey(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
);

export type FreshnessWatchdogDiscovery = typeof freshnessWatchdogDiscoveries.$inferSelect;
