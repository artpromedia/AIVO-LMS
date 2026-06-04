/**
 * Sprint 3 — retention job. Archives audit partitions older than the tenant
 * `min_days` (default 2555 ≈ 7y FERPA) to cold object-lock storage, then
 * detaches/drops the aged monthly partitions from the hot table.
 *
 * `audit_events_v2` is range-partitioned by month, so pruning is a fast
 * DETACH/DROP per partition rather than a mass DELETE. The partition-name
 * arithmetic is a pure, unit-tested helper; the DB/WORM effects live behind
 * injectable ports.
 */
export const FERPA_MIN_DAYS = 2555;

/** Partition suffix (YYYYMM) for a given month start. */
export function partitionSuffix(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Given the set of existing partition suffixes and a retention window,
 * return the suffixes whose entire month is older than the cutoff and may be
 * archived + dropped. Pure.
 */
export function partitionsToPrune(
  existingSuffixes: string[],
  minDays: number,
  now: Date = new Date(),
): string[] {
  const cutoff = new Date(now.getTime() - minDays * 24 * 60 * 60 * 1000);
  // The partition's month must END before the cutoff to be fully expired.
  const cutoffSuffix = partitionSuffix(cutoff);
  return existingSuffixes.filter((s) => /^\d{6}$/.test(s) && s < cutoffSuffix).sort();
}

export interface PartitionArchiver {
  /** List existing audit_events_v2 monthly partition suffixes (YYYYMM). */
  listPartitions(): Promise<string[]>;
  /** Copy a partition's rows to cold object-lock storage. */
  archive(suffix: string): Promise<void>;
  /** Detach + drop the partition from the hot table. */
  drop(suffix: string): Promise<void>;
}

export interface RetentionResult {
  pruned: string[];
}

export async function runRetentionOnce(
  archiver: PartitionArchiver,
  opts: { minDays?: number; now?: Date } = {},
): Promise<RetentionResult> {
  const minDays = opts.minDays ?? FERPA_MIN_DAYS;
  const existing = await archiver.listPartitions();
  const toPrune = partitionsToPrune(existing, minDays, opts.now);
  for (const suffix of toPrune) {
    await archiver.archive(suffix); // to object-lock first…
    await archiver.drop(suffix); // …then detach/drop from hot table
  }
  return { pruned: toPrune };
}
