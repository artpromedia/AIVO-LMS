/**
 * Pure day-bucketing helpers so growth charts are computed from real
 * `{ createdAt }[]` lists instead of hand-faked series. Buckets are UTC day
 * keys (`YYYY-MM-DD`) and the returned series is continuous (zero-filled
 * between the first and last observed day) so area/line charts never skip
 * days. The output shape feeds AreaTrend directly.
 */
import type { AreaTrendPoint } from "./charts/AreaTrend.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function utcDayStart(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function toDate<T>(item: T, getDate: (item: T) => Date | string): Date {
  const raw = getDate(item);
  return raw instanceof Date ? raw : new Date(raw);
}

/** Daily counts: one point per UTC day from the earliest to the latest item. */
export function bucketByDay<T>(
  items: readonly T[],
  getDate: (item: T) => Date | string,
): AreaTrendPoint[] {
  if (items.length === 0) return [];

  const counts = new Map<string, number>();
  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    const date = toDate(item, getDate);
    const key = utcDayKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const dayStart = utcDayStart(date);
    first = Math.min(first, dayStart);
    last = Math.max(last, dayStart);
  }

  const points: AreaTrendPoint[] = [];
  for (let day = first; day <= last; day += DAY_MS) {
    const key = utcDayKey(new Date(day));
    points.push({ t: key, value: counts.get(key) ?? 0 });
  }
  return points;
}

/** Running total per UTC day — the cumulative view of {@link bucketByDay}. */
export function cumulativeOverTime<T>(
  items: readonly T[],
  getDate: (item: T) => Date | string,
): AreaTrendPoint[] {
  let runningTotal = 0;
  return bucketByDay(items, getDate).map((point) => {
    runningTotal += point.value;
    return { t: point.t, value: runningTotal };
  });
}
