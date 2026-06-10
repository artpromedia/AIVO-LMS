/**
 * Platform usage trends — daily new-user / new-learner counts.
 *
 * The route in routes/platform.ts runs one grouped count per table and
 * hands the sparse rows to `buildUsageTrendSeries`, which zero-fills the
 * window so the chart always renders a continuous series ending today.
 * Day bucketing happens in UTC on both sides (SQL `date_trunc` and the
 * series builder) so a point's key is stable regardless of server locale.
 */

export const USAGE_TRENDS_DEFAULT_DAYS = 14;
export const USAGE_TRENDS_MAX_DAYS = 90;

export interface UsageTrendBucketRow {
  /** UTC day key, `YYYY-MM-DD`. */
  day: string;
  count: number | string | null;
}

export interface UsageTrendPoint {
  day: string;
  newUsers: number;
  newLearners: number;
}

/** Parse the `?days=` query: integer clamped to 1..90, defaulting to 14. */
export function clampTrendDays(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return USAGE_TRENDS_DEFAULT_DAYS;
  return Math.max(1, Math.min(USAGE_TRENDS_MAX_DAYS, Math.trunc(parsed)));
}

/** UTC day key (`YYYY-MM-DD`) for a date. */
export function utcDayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Start of the UTC day `days - 1` days before `now` — the window's left edge. */
export function trendWindowStart(days: number, now: Date): Date {
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(todayStart - (days - 1) * 24 * 60 * 60 * 1000);
}

export function buildUsageTrendSeries(args: {
  days: number;
  now: Date;
  users: UsageTrendBucketRow[];
  learners: UsageTrendBucketRow[];
}): UsageTrendPoint[] {
  const usersByDay = new Map(args.users.map((row) => [row.day, Number(row.count ?? 0)]));
  const learnersByDay = new Map(args.learners.map((row) => [row.day, Number(row.count ?? 0)]));

  const start = trendWindowStart(args.days, args.now);
  const points: UsageTrendPoint[] = [];
  for (let i = 0; i < args.days; i += 1) {
    const day = utcDayKey(new Date(start.getTime() + i * 24 * 60 * 60 * 1000));
    points.push({
      day,
      newUsers: usersByDay.get(day) ?? 0,
      newLearners: learnersByDay.get(day) ?? 0,
    });
  }
  return points;
}
