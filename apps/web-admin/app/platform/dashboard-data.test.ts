import { describe, expect, it } from "vitest";
import { aiCostByHour, aiCostDelta, aiRequestsByHour, growthKpi } from "./dashboard-data";
import type { RecentAiActivityEntry } from "@aivo/admin-api";

const NOW = new Date("2026-06-10T12:30:00.000Z");

function aiEvent(hoursAgo: number, overrides: Partial<RecentAiActivityEntry> = {}): RecentAiActivityEntry {
  return {
    id: `evt-${hoursAgo}-${Math.random()}`,
    provider: "e2e",
    model: "test",
    inputTokens: 100,
    outputTokens: 50,
    latencyMs: 500,
    estimatedCostUsd: 0.1,
    learnerId: null,
    tenantId: null,
    tenantName: null,
    createdAt: new Date(NOW.getTime() - hoursAgo * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

describe("growthKpi", () => {
  it("computes total, 7-day delta, and a cumulative sparkline", () => {
    const rows = [
      { createdAt: "2026-05-20T10:00:00.000Z" }, // before the 7-day window
      { createdAt: "2026-05-21T10:00:00.000Z" },
      { createdAt: "2026-06-08T10:00:00.000Z" }, // inside the window
      { createdAt: "2026-06-10T10:00:00.000Z" },
    ];
    const kpi = growthKpi(rows, NOW);
    expect(kpi.value).toBe(4);
    expect(kpi.delta).toBe(2);
    expect(kpi.trend.at(-1)).toBe(4);
    expect(kpi.trend.length).toBeGreaterThan(1);
  });

  it("pads a single-day history so the sparkline still has a shape", () => {
    const kpi = growthKpi([{ createdAt: NOW.toISOString() }], NOW);
    expect(kpi.trend).toEqual([0, 1]);
    expect(kpi.delta).toBe(1);
  });

  it("handles an empty list", () => {
    const kpi = growthKpi([], NOW);
    expect(kpi).toEqual({ value: 0, delta: 0, trend: [] });
  });
});

describe("aiRequestsByHour", () => {
  it("buckets 24 hours with counts and average latency", () => {
    const events = [
      aiEvent(0.1, { latencyMs: 400 }),
      aiEvent(0.2, { latencyMs: 600 }),
      aiEvent(3, { latencyMs: 900 }),
      aiEvent(30), // outside the window — dropped
    ];
    const series = aiRequestsByHour(events, NOW);
    expect(series).toHaveLength(24);
    expect(series.at(-1)).toEqual({ t: "12:00", value: 2, value2: 500 });
    expect(series.at(-4)).toEqual({ t: "09:00", value: 1, value2: 900 });
    expect(series.reduce((sum, point) => sum + point.value, 0)).toBe(3);
  });
});

describe("aiCostByHour / aiCostDelta", () => {
  it("sums hourly cost and compares the last 12h to the 12h before", () => {
    const events = [
      aiEvent(1, { estimatedCostUsd: 0.5 }),
      aiEvent(2, { estimatedCostUsd: 0.25 }),
      aiEvent(15, { estimatedCostUsd: 0.2 }), // prior 12h window
      aiEvent(30, { estimatedCostUsd: 9 }), // outside 24h — ignored
    ];
    const costs = aiCostByHour(events, NOW);
    expect(costs).toHaveLength(24);
    expect(costs.reduce((a, b) => a + b, 0)).toBeCloseTo(0.95);
    expect(aiCostDelta(events, NOW)).toBeCloseTo(0.75 - 0.2);
  });
});
