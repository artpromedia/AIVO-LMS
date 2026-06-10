/**
 * Trend-compute helpers — shared analytics utilities for all role
 * dashboard pages.
 *
 * All functions are pure (no side effects, no external dependencies) so
 * they are straightforward to unit-test and safe to import on the server.
 */

/**
 * A single data point for chart series.
 * Mirrors `ChartPoint` from `@aivo/ui/chart` — defined locally so this
 * module has zero React / DOM dependencies and is safe to use in server
 * components and pure unit tests.
 */
export type TrendPoint = { label: string; value: number };

/** Any item that has a `createdAt` date field. */
export interface Timestamped {
  createdAt: string | Date;
}

/**
 * Compute a signed percentage delta between the current and prior
 * periods.
 *
 * - Returns `null` when `priorValue` is 0 (avoids division-by-zero /
 *   Infinity). When both values are 0 this is also covered, since the
 *   check is solely on `priorValue`.
 * - Returns a rounded integer (e.g. 5, -12) — suitable for display as
 *   "±N%" without decimal noise.
 */
export function computeDeltaPct(currentValue: number, priorValue: number): number | null {
  if (priorValue === 0) return null;
  const delta = ((currentValue - priorValue) / priorValue) * 100;
  return Math.round(delta);
}

/**
 * Bucket a list of timestamped items by calendar day or ISO week.
 *
 * Returns a Map keyed by the bucket string (e.g. "2024-03-14" or "2024-W11"),
 * with the count of items that fall into that bucket.
 */
export function bucketByPeriod(
  items: ReadonlyArray<Timestamped>,
  period: "day" | "week",
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const d = new Date(item.createdAt);
    if (isNaN(d.getTime())) continue;
    const key =
      period === "day"
        ? d.toISOString().slice(0, 10) // YYYY-MM-DD
        : `${d.getUTCFullYear()}-W${isoWeek(d).toString().padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

/**
 * Compute a time-series of a scalar metric over bucketed periods.
 *
 * The `metricFn` receives all items for a bucket and returns a scalar
 * value (e.g. count, average). Buckets with no items are filled with 0
 * so the resulting series is always contiguous.
 *
 * @param items         — full item list (any timestamped records)
 * @param metricFn      — transform a bucket's items into a number
 * @param period        — "day" or "week"
 * @param slots         — number of most-recent periods to include (default 30)
 * @returns             sorted array of `{ label, value }` TrendPoints
 */
export function computeMetricHistory<T extends Timestamped>(
  items: ReadonlyArray<T>,
  metricFn: (bucketItems: ReadonlyArray<T>) => number,
  period: "day" | "week",
  slots = 30,
): TrendPoint[] {
  if (items.length === 0) return [];

  // Group items by bucket key
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const d = new Date(item.createdAt);
    if (isNaN(d.getTime())) continue;
    const key =
      period === "day"
        ? d.toISOString().slice(0, 10)
        : `${d.getUTCFullYear()}-W${isoWeek(d).toString().padStart(2, "0")}`;
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }

  if (grouped.size === 0) return [];

  // Build a contiguous range ending at today
  const today = new Date();
  const points: TrendPoint[] = [];
  for (let i = slots - 1; i >= 0; i--) {
    const date = new Date(today);
    if (period === "day") {
      date.setDate(today.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      const bucketItems = grouped.get(key) ?? [];
      points.push({ label: key.slice(5), value: metricFn(bucketItems) }); // "MM-DD"
    } else {
      date.setDate(today.getDate() - i * 7);
      const key = `${date.getUTCFullYear()}-W${isoWeek(date).toString().padStart(2, "0")}`;
      const bucketItems = grouped.get(key) ?? [];
      const weekLabel = `W${isoWeek(date)}`;
      points.push({ label: weekLabel, value: metricFn(bucketItems) });
    }
  }

  // Drop leading zeros (no data before the earliest real point)
  const firstNonZero = points.findIndex((p) => p.value > 0);
  return firstNonZero === -1 ? [] : points.slice(firstNonZero);
}

/**
 * Split an item list into "current period" vs "prior period" halves
 * based on a cutoff date.
 *
 * Used by pages to derive `deltaPct` without re-implementing the
 * partition logic every time.
 */
export function splitIntoPeriods<T extends Timestamped>(
  items: ReadonlyArray<T>,
  cutoffDate: Date,
): { current: T[]; prior: T[] } {
  const current: T[] = [];
  const prior: T[] = [];
  for (const item of items) {
    const d = new Date(item.createdAt);
    if (d >= cutoffDate) {
      current.push(item);
    } else {
      prior.push(item);
    }
  }
  return { current, prior };
}

/**
 * Build a consistent accessible aria-label for a KPI card with an optional delta.
 *
 * Examples:
 *   buildKpiAriaLabel("Lessons completed", "42") → "Lessons completed, 42"
 *   buildKpiAriaLabel("Lessons completed", "42", 15, "vs last 30 days")
 *     → "Lessons completed, 42, up 15% vs last 30 days"
 */
export function buildKpiAriaLabel(
  label: string,
  value: string,
  deltaPct?: number | null,
  periodLabel?: string,
): string {
  const parts: string[] = [label, value];
  if (deltaPct != null) {
    const dir = deltaPct > 0 ? "up" : deltaPct < 0 ? "down" : "no change";
    const mag = deltaPct !== 0 ? ` ${Math.abs(deltaPct)}%` : "";
    const period = periodLabel ? ` ${periodLabel}` : "";
    parts.push(`${dir}${mag}${period}`);
  }
  return parts.join(", ");
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** ISO week number (1–53) for a Date.
 *
 * Algorithm: shift each date to the nearest Thursday (Thursday-based ISO
 * weeks per ISO 8601). Specifically, `4 - (dayOfWeek || 7)` adjusts so
 * that Mon→Thu is +3…0 and Fri→Sun is -1…-2, landing every date on its
 * week's Thursday. Then divide the offset from Jan 1 by 7.
 * 86400000 = milliseconds per day (24 × 60 × 60 × 1000).
 */
function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
