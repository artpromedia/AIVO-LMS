/**
 * Shared freshness logic used by the watchdog and the freshness dashboard so
 * both report the same status for the same row.
 */

export type FreshnessStatus = "fresh" | "warning" | "stale" | "never_run";

export interface FreshnessRecord {
  jobName: string;
  /** Expected period between runs in ms. */
  periodMs: number;
  /** Last run start, or null if never run. */
  lastRunAt: Date | null;
  /** Last run finish, or null if never finished or never run. */
  lastFinishedAt: Date | null;
  /** Last run status as reported by the job (`ok` / `partial` / `failed`). */
  lastStatus: string | null;
}

export interface FreshnessReport {
  jobName: string;
  status: FreshnessStatus;
  ageMs: number | null;
  lastRunAt: Date | null;
  lastFinishedAt: Date | null;
  /** True if the last reported status was `failed` (still red, even if fresh). */
  failed: boolean;
}

/**
 * A run is `fresh` if the last finish is within `periodMs * 1.1` of `now`,
 * `warning` between 1.1× and 1.5× the period, and `stale` after that.
 *
 * The 10% slack avoids flapping when ticks happen near the boundary.
 */
export function computeFreshness(record: FreshnessRecord, now: Date = new Date()): FreshnessReport {
  const last = record.lastFinishedAt ?? record.lastRunAt;
  const failed = record.lastStatus === "failed";
  if (!last) {
    return {
      jobName: record.jobName,
      status: "never_run",
      ageMs: null,
      lastRunAt: record.lastRunAt,
      lastFinishedAt: record.lastFinishedAt,
      failed,
    };
  }
  const ageMs = now.getTime() - last.getTime();
  const fresh = record.periodMs * 1.1;
  const warn = record.periodMs * 1.5;
  let status: FreshnessStatus = "fresh";
  if (ageMs >= warn) status = "stale";
  else if (ageMs >= fresh) status = "warning";
  return {
    jobName: record.jobName,
    status,
    ageMs,
    lastRunAt: record.lastRunAt,
    lastFinishedAt: record.lastFinishedAt,
    failed,
  };
}
