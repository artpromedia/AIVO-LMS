/**
 * Sprint 7 — `@aivo/scheduling`.
 *
 * A small wrapper around node `setInterval` that turns naive single-leader
 * `setInterval(work, 24h)` cron loops into a fleet-wide, crash-safe schedule:
 *
 *   - Every replica ticks every `tickIntervalMs` (default ~5min).
 *   - On each tick, the replica races for a Postgres advisory lock keyed by the
 *     job name. Whichever wins reads the `daily_job_runs` row, decides whether
 *     this period's run already happened, and either runs the work or returns.
 *   - The lock-holder updates the ledger and pushes an entry to the
 *     append-only history (`periodic_job_runs`).
 *
 * Crash safety: if the leader dies between ticks, the lock is released by
 * Postgres at session end, and the next replica's tick will pick up the work
 * for the day. If it dies *during* the work, no other replica will run today
 * because `last_run_at` was stamped at the start; that is acceptable for
 * reminder workloads where re-running mid-day is worse than skipping.
 */
export type LeaderLock = {
  /**
   * Try to acquire the advisory lock for `jobName`. Returns a release function
   * if acquired, or `null` if another replica already holds it.
   */
  tryAcquire(jobName: string): Promise<(() => Promise<void>) | null>;
};

export type JobLedger = {
  /**
   * Returns the last `last_run_at` for `jobName`, or `null` if never run.
   * Should be called inside the lock so the read sees the leader's most
   * recent stamp.
   */
  getLastRunAt(jobName: string): Promise<Date | null>;

  /**
   * Stamp the *start* of a new run. The next replica that wakes up will see
   * this and skip until tomorrow.
   */
  markStarted(input: { jobName: string; runAt: Date; replicaId: string }): Promise<void>;

  /**
   * Stamp the *end* of a run with its outcome.
   */
  markFinished(input: {
    jobName: string;
    finishedAt: Date;
    status: "ok" | "partial" | "failed";
    sent?: number;
    failed?: number;
    error?: string;
  }): Promise<void>;

  /**
   * Append a row to the periodic-job-runs history table.
   */
  appendHistory(input: {
    jobName: string;
    runAt: Date;
    finishedAt: Date;
    replicaId: string;
    status: "ok" | "partial" | "failed";
    durationMs: number;
    error?: string;
  }): Promise<void>;
};

/**
 * Remediation Sprint 06 — a fixed weekly wall-clock target ("Sunday 23:00").
 * The period-based scheduler cannot express day-of-week; jobs that must run
 * at a specific weekly moment (the Creator's Sunday-night lesson
 * pre-generation) declare one of these instead of a period.
 *
 * Times are interpreted in UTC plus `utcOffsetMinutes` (e.g. -300 for
 * US-Eastern standard time). A run is due on the first tick AFTER the most
 * recent weekly target that `lastRunAt` predates — exactly once per week,
 * regardless of tick cadence or how long the fleet was down.
 */
export interface WeeklySchedule {
  /** 0 = Sunday … 6 = Saturday. */
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Hour of day, 0-23. */
  hour: number;
  /** Minute of hour, default 0. */
  minute?: number;
  /** Fixed offset from UTC in minutes (default 0 = UTC). */
  utcOffsetMinutes?: number;
}

/** The most recent occurrence of the weekly target at or before `now`. */
export function lastWeeklyTarget(schedule: WeeklySchedule, now: Date): Date {
  const offsetMs = (schedule.utcOffsetMinutes ?? 0) * 60_000;
  const local = new Date(now.getTime() + offsetMs);
  const target = new Date(local.getTime());
  target.setUTCHours(schedule.hour, schedule.minute ?? 0, 0, 0);
  const dayDelta = (local.getUTCDay() - schedule.dayOfWeek + 7) % 7;
  target.setUTCDate(target.getUTCDate() - dayDelta);
  if (target.getTime() > local.getTime()) target.setUTCDate(target.getUTCDate() - 7);
  return new Date(target.getTime() - offsetMs);
}

/** Weekly-schedule due check: has the most recent target passed without a
 *  run at/after it? */
export function isDueWeekly(opts: {
  lastRunAt: Date | null;
  now: Date;
  schedule: WeeklySchedule;
}): boolean {
  const target = lastWeeklyTarget(opts.schedule, opts.now);
  if (!opts.lastRunAt) return opts.now.getTime() >= target.getTime();
  return opts.lastRunAt.getTime() < target.getTime();
}

export interface SafeCronOptions {
  jobName: string;
  /** Wall-clock period between runs. Default: 24h. Ignored when `schedule`
   *  is set. */
  periodMs?: number;
  /** Remediation Sprint 06: fixed weekly wall-clock target. When set, the
   *  job is due exactly once per week — on the first tick after the target
   *  — instead of on a rolling period. */
  schedule?: WeeklySchedule;
  /** How often each replica wakes up to race for the lock. Default: 5min. */
  tickIntervalMs?: number;
  /** Replica identifier baked into the ledger row for diagnostics. */
  replicaId?: string;
  ledger: JobLedger;
  lock: LeaderLock;
  /**
   * The actual work to run. Should return a `JobOutcome` so the ledger can
   * record sent/failed counts. Throwing is caught and recorded as `failed`.
   */
  run: () => Promise<JobOutcome>;
  log?: {
    info: {
      (msg: string, data?: Record<string, unknown>): void;
      (data: Record<string, unknown>, msg?: string): void;
    };
    error: {
      (msg: string, data?: Record<string, unknown>): void;
      (data: Record<string, unknown> | Error | unknown, msg?: string): void;
    };
  };
}

export interface JobOutcome {
  status: "ok" | "partial" | "failed";
  sent?: number;
  failed?: number;
  walked?: number;
  drift?: number;
  errors?: number;
}

export interface SafeCronHandle {
  /** Stop the underlying interval. */
  stop(): void;
  /** Run a single tick out-of-band (e.g. admin "Run now"). */
  triggerOnce(): Promise<{ ran: boolean; outcome?: JobOutcome; reason?: string }>;
}

/**
 * Decide whether a run is *due*. A run is due when:
 *   - There's no recorded last_run_at, or
 *   - `now - last_run_at >= periodMs - jitterMs` (jitter accounts for tick drift).
 *
 * The default jitter is half the tick interval.
 */
export function isDue(opts: {
  lastRunAt: Date | null;
  now: Date;
  periodMs: number;
  jitterMs?: number;
}): boolean {
  if (!opts.lastRunAt) return true;
  const jitter = opts.jitterMs ?? 0;
  const elapsed = opts.now.getTime() - opts.lastRunAt.getTime();
  return elapsed >= opts.periodMs - jitter;
}

const DEFAULT_PERIOD_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TICK_MS = 5 * 60 * 1000;

export function startSafeCron(opts: SafeCronOptions): SafeCronHandle {
  const periodMs = opts.periodMs ?? DEFAULT_PERIOD_MS;
  const tickIntervalMs = opts.tickIntervalMs ?? DEFAULT_TICK_MS;
  const replicaId = opts.replicaId ?? `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  const log = opts.log;

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<unknown> | null = null;

  async function singleTick(force = false): Promise<{
    ran: boolean;
    outcome?: JobOutcome;
    reason?: string;
  }> {
    if (stopped) return { ran: false, reason: "stopped" };
    const release = await opts.lock.tryAcquire(opts.jobName);
    if (!release) return { ran: false, reason: "not-leader" };
    try {
      const lastRunAt = await opts.ledger.getLastRunAt(opts.jobName);
      const now = new Date();
      const due = opts.schedule
        ? isDueWeekly({ lastRunAt, now, schedule: opts.schedule })
        : isDue({ lastRunAt, now, periodMs, jitterMs: tickIntervalMs / 2 });
      if (!force && !due) {
        return { ran: false, reason: "not-due" };
      }
      await opts.ledger.markStarted({ jobName: opts.jobName, runAt: now, replicaId });
      const start = now.getTime();
      let outcome: JobOutcome = { status: "failed" };
      let error: string | undefined;
      try {
        outcome = await opts.run();
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        outcome = { status: "failed" };
        log?.error("scheduled job threw", { err: error, jobName: opts.jobName });
      }
      const finishedAt = new Date();
      await opts.ledger.markFinished({
        jobName: opts.jobName,
        finishedAt,
        status: outcome.status,
        sent: outcome.sent,
        failed: outcome.failed,
        error,
      });
      await opts.ledger.appendHistory({
        jobName: opts.jobName,
        runAt: now,
        finishedAt,
        replicaId,
        status: outcome.status,
        durationMs: finishedAt.getTime() - start,
        error,
      });
      log?.info("scheduled job finished", {
        jobName: opts.jobName,
        status: outcome.status,
        replicaId,
      });
      return { ran: true, outcome };
    } finally {
      try {
        await release();
      } catch (e) {
        log?.error("failed to release advisory lock", {
          err: e instanceof Error ? e.message : String(e),
          jobName: opts.jobName,
        });
      }
    }
  }

  function scheduleNext() {
    if (stopped) return;
    timer = setTimeout(async () => {
      inFlight = singleTick().catch((e) => {
        log?.error("scheduled tick crashed", {
          err: e instanceof Error ? e.message : String(e),
          jobName: opts.jobName,
        });
      });
      await inFlight;
      inFlight = null;
      scheduleNext();
    }, tickIntervalMs);
    if (typeof (timer as { unref?: () => void }).unref === "function") {
      (timer as unknown as { unref: () => void }).unref();
    }
  }

  // First tick fires shortly after boot so devs see something happen.
  timer = setTimeout(
    () => {
      inFlight = singleTick()
        .then(() => {})
        .catch((e) => {
          log?.error("first tick crashed", {
            err: e instanceof Error ? e.message : String(e),
            jobName: opts.jobName,
          });
        });
      scheduleNext();
    },
    Math.min(5_000, tickIntervalMs),
  );
  if (typeof (timer as { unref?: () => void }).unref === "function") {
    (timer as unknown as { unref: () => void }).unref();
  }

  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
    async triggerOnce() {
      return singleTick(true);
    },
  };
}

export {
  createDrizzleLedger,
  createDrizzleAdvisoryLock,
  type DrizzleLikeDb,
} from "./drizzle-impl.js";

export { computeFreshness, type FreshnessRecord, type FreshnessStatus } from "./freshness.js";

export type JobRegistryEntry = {
  jobName: string;
  service: string;
  description: string;
  /** Expected period between runs in ms. */
  periodMs: number;
};

/**
 * The fleet-wide job registry. Services advertise their scheduled jobs here so
 * the admin console can list everything that *should* be running, even before
 * the first tick has happened.
 */
export const JOB_REGISTRY: JobRegistryEntry[] = [
  {
    jobName: "billing.daily-expiry-reminders",
    service: "billing-svc",
    description: "Send expiry reminder emails to subscribers whose plan ends soon.",
    periodMs: DEFAULT_PERIOD_MS,
  },
  {
    jobName: "admin.soc2-evidence",
    service: "admin-svc",
    description: "Generate the daily SOC 2 evidence bundle.",
    periodMs: DEFAULT_PERIOD_MS,
  },
  {
    jobName: "family.weekly-summary",
    service: "family-svc",
    description: "Send the weekly family summary email.",
    periodMs: 7 * DEFAULT_PERIOD_MS,
  },
  {
    jobName: "research.weekly-aggregation",
    service: "research-svc",
    description: "Roll up research metrics for the past week.",
    periodMs: 7 * DEFAULT_PERIOD_MS,
  },
  {
    jobName: "comms.digest-cleanup",
    service: "comms-svc",
    description: "Drop expired notification digest rows.",
    periodMs: DEFAULT_PERIOD_MS,
  },
  {
    jobName: "engagement.weekly-rollup",
    service: "engagement-svc",
    description: "Aggregate the previous week's XP into the per-learner rollup table.",
    periodMs: 7 * DEFAULT_PERIOD_MS,
  },
  {
    jobName: "integration.connector-sync-watchdog",
    service: "integration-svc",
    description: "Flag integration_connections rows whose external sync has gone stale.",
    periodMs: DEFAULT_PERIOD_MS,
  },
  {
    jobName: "identity.session-housekeeping",
    service: "identity-svc",
    description: "Expire stale sessions and refresh-token rows.",
    periodMs: DEFAULT_PERIOD_MS,
  },
  {
    jobName: "admin.audit-retention",
    service: "admin-svc",
    description: "Apply the retention window to the admin audit log.",
    periodMs: DEFAULT_PERIOD_MS,
  },
  {
    jobName: "admin.run-history-janitor",
    service: "admin-svc",
    description: "Delete orphaned periodic_job_runs and billing_daily_job_runs rows.",
    periodMs: DEFAULT_PERIOD_MS,
  },
  {
    jobName: "curriculum.pacing-advance",
    service: "admin-svc",
    description:
      "Advance learner_pacing_weeks.status (planned/active/done) to match the calendar for active pacing plans.",
    periodMs: DEFAULT_PERIOD_MS,
  },
  {
    jobName: "tutor.memory-expiry",
    service: "admin-svc",
    description: "Purge tutor_memories rows past their 180-day expires_at.",
    periodMs: DEFAULT_PERIOD_MS,
  },
  {
    jobName: "creator.weekly-generation",
    service: "admin-svc",
    description:
      "Sunday-night Creator: pre-generate each active learner's next playable lesson " +
      "(ready LessonRun + plan) via web-v2's internal creator route, so the week starts " +
      "with zero generation latency.",
    periodMs: 7 * DEFAULT_PERIOD_MS,
  },
];
