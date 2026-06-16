/**
 * Pure shaping for the /platform operations dashboard. Everything here is
 * computed from real admin-api reads (no synthetic numbers): KPI growth from
 * createdAt lists via cumulativeOverTime, and AI request/cost series bucketed
 * by hour from the recent-activity event log.
 */
import { cumulativeOverTime, type AreaTrendPoint } from "@aivo/admin-ui";
import type { RecentAiActivityEntry } from "@aivo/admin-api";

const HOUR_MS = 60 * 60 * 1000;

export interface KpiSeries {
  value: number;
  /** Net additions over the trailing 7 days (counts only grow). */
  delta: number;
  /** Cumulative growth curve for the sparkline (oldest → newest). */
  trend: number[];
}

export function growthKpi(rows: Array<{ createdAt: string }>, now = new Date()): KpiSeries {
  const series = cumulativeOverTime(rows, (row) => row.createdAt);
  const value = rows.length;
  const weekAgoKey = new Date(now.getTime() - 7 * 24 * HOUR_MS).toISOString().slice(0, 10);
  let weekAgoTotal = 0;
  for (const point of series) {
    if (point.t <= weekAgoKey) weekAgoTotal = point.value;
    else break;
  }
  // A single-day history still gets a 2-point sparkline (count was 0 before).
  const trend =
    series.length === 1 ? [0, series[0].value] : series.slice(-30).map((point) => point.value);
  return { value, delta: value - weekAgoTotal, trend };
}

function hourStart(date: Date): number {
  return Math.floor(date.getTime() / HOUR_MS) * HOUR_MS;
}

function hourLabel(ms: number): string {
  return `${String(new Date(ms).getUTCHours()).padStart(2, "0")}:00`;
}

/** `hours` hourly buckets ending now: request count + average latency per hour. */
export function aiRequestsByHour(
  events: RecentAiActivityEntry[],
  now = new Date(),
  hours = 24,
): AreaTrendPoint[] {
  const newest = hourStart(now);
  const buckets = new Map<number, { count: number; latencyTotal: number }>();
  for (let i = hours - 1; i >= 0; i -= 1) buckets.set(newest - i * HOUR_MS, { count: 0, latencyTotal: 0 });
  for (const event of events) {
    const bucket = buckets.get(hourStart(new Date(event.createdAt)));
    if (!bucket) continue;
    bucket.count += 1;
    bucket.latencyTotal += event.latencyMs;
  }
  return [...buckets.entries()].map(([start, bucket]) => ({
    t: hourLabel(start),
    value: bucket.count,
    value2: bucket.count > 0 ? Math.round(bucket.latencyTotal / bucket.count) : 0,
  }));
}

/** 24 hourly cost sums ending now — the AI-cost KPI sparkline. */
export function aiCostByHour(events: RecentAiActivityEntry[], now = new Date()): number[] {
  const newest = hourStart(now);
  const buckets = new Map<number, number>();
  for (let i = 23; i >= 0; i -= 1) buckets.set(newest - i * HOUR_MS, 0);
  for (const event of events) {
    const start = hourStart(new Date(event.createdAt));
    if (buckets.has(start)) buckets.set(start, (buckets.get(start) ?? 0) + event.estimatedCostUsd);
  }
  return [...buckets.values()];
}

/** Spend in the last 12h minus spend in the 12h before that. */
export function aiCostDelta(events: RecentAiActivityEntry[], now = new Date()): number {
  const cutRecent = now.getTime() - 12 * HOUR_MS;
  const cutOld = now.getTime() - 24 * HOUR_MS;
  let recent = 0;
  let prior = 0;
  for (const event of events) {
    const at = new Date(event.createdAt).getTime();
    if (at >= cutRecent) recent += event.estimatedCostUsd;
    else if (at >= cutOld) prior += event.estimatedCostUsd;
  }
  return recent - prior;
}

export function formatUsd(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
