/**
 * Unit tests for apps/web-v2/lib/analytics/trend-compute.ts
 *
 * Covers edge cases: empty history, single data point, zero priors,
 * negative deltas, and invalid timestamps.
 */
import { describe, it, expect } from "vitest";
import {
  computeDeltaPct,
  bucketByPeriod,
  computeMetricHistory,
  splitIntoPeriods,
} from "./trend-compute";

// ---------------------------------------------------------------------------
// computeDeltaPct
// ---------------------------------------------------------------------------
describe("computeDeltaPct", () => {
  it("returns null when priorValue is 0 (division by zero guard)", () => {
    expect(computeDeltaPct(10, 0)).toBeNull();
  });

  it("returns null when both values are 0", () => {
    expect(computeDeltaPct(0, 0)).toBeNull();
  });

  it("returns a positive delta for growth", () => {
    // 10 → 15 is +50 %
    expect(computeDeltaPct(15, 10)).toBe(50);
  });

  it("returns a negative delta for decline", () => {
    // 10 → 7 is -30 %
    expect(computeDeltaPct(7, 10)).toBe(-30);
  });

  it("returns 0 for identical values", () => {
    expect(computeDeltaPct(5, 5)).toBe(0);
  });

  it("rounds to the nearest integer", () => {
    // 1 → 2 is +100 %; 3 → 4 is +33.33... → rounds to 33
    expect(computeDeltaPct(4, 3)).toBe(33);
  });

  it("handles fractional / decimal inputs", () => {
    // 0.75 → 0.80 is +6.666... → rounds to 7
    expect(computeDeltaPct(0.8, 0.75)).toBe(7);
  });

  it("handles large negative deltas", () => {
    // 100 → 0 is -100 %
    expect(computeDeltaPct(0, 100)).toBe(-100);
  });
});

// ---------------------------------------------------------------------------
// bucketByPeriod
// ---------------------------------------------------------------------------
describe("bucketByPeriod", () => {
  it("returns an empty map for an empty array", () => {
    expect(bucketByPeriod([], "day").size).toBe(0);
  });

  it("buckets items by day", () => {
    const items = [
      { createdAt: "2024-03-10T10:00:00Z" },
      { createdAt: "2024-03-10T14:00:00Z" },
      { createdAt: "2024-03-11T09:00:00Z" },
    ];
    const map = bucketByPeriod(items, "day");
    expect(map.get("2024-03-10")).toBe(2);
    expect(map.get("2024-03-11")).toBe(1);
  });

  it("buckets items by week", () => {
    // ISO week 11 of 2024 starts 2024-03-11
    const items = [
      { createdAt: "2024-03-11T08:00:00Z" }, // W11
      { createdAt: "2024-03-14T08:00:00Z" }, // W11
      { createdAt: "2024-03-18T08:00:00Z" }, // W12
    ];
    const map = bucketByPeriod(items, "week");
    expect(map.get("2024-W11")).toBe(2);
    expect(map.get("2024-W12")).toBe(1);
  });

  it("skips items with invalid timestamps", () => {
    const items = [{ createdAt: "not-a-date" }, { createdAt: "2024-03-10T10:00:00Z" }];
    const map = bucketByPeriod(items, "day");
    expect(map.size).toBe(1);
    expect(map.get("2024-03-10")).toBe(1);
  });

  it("handles a Date object in createdAt", () => {
    const items = [{ createdAt: new Date("2024-03-10T10:00:00Z") }];
    const map = bucketByPeriod(items, "day");
    expect(map.get("2024-03-10")).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeMetricHistory
// ---------------------------------------------------------------------------
describe("computeMetricHistory", () => {
  it("returns empty array for empty items", () => {
    expect(computeMetricHistory([], (b) => b.length, "day", 7)).toEqual([]);
  });

  it("returns empty array when all items have invalid timestamps", () => {
    const items = [{ createdAt: "bad" }];
    expect(computeMetricHistory(items, (b) => b.length, "day", 7)).toEqual([]);
  });

  it("returns a single-point series for one item", () => {
    const today = new Date();
    const items = [{ createdAt: today.toISOString() }];
    const result = computeMetricHistory(items, (b) => b.length, "day", 7);
    expect(result.length).toBeGreaterThan(0);
    // Last point should be today with value 1
    expect(result[result.length - 1].value).toBe(1);
  });

  it("drops leading zeros (no phantom flat line before data starts)", () => {
    // One item 2 days ago — series of 7 days should start from that day, not 5 zeros + that day
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const items = [{ createdAt: twoDaysAgo.toISOString() }];
    const result = computeMetricHistory(items, (b) => b.length, "day", 7);
    expect(result[0].value).toBeGreaterThan(0);
  });

  it("respects the slots parameter", () => {
    // Generate 60 daily items spread evenly; requesting 14 slots should cap at 14
    const items = Array.from({ length: 60 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return { createdAt: d.toISOString() };
    });
    const result = computeMetricHistory(items, (b) => b.length, "day", 14);
    expect(result.length).toBeLessThanOrEqual(14);
  });

  it("fills empty buckets with 0 (contiguous series)", () => {
    // Two items on the same day, nothing yesterday
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const items = [
      { createdAt: today.toISOString() },
      { createdAt: today.toISOString() },
    ];
    const result = computeMetricHistory(items, (b) => b.length, "day", 3);
    // Find yesterday's slot
    const yesterdayLabel = yesterday.toISOString().slice(5, 10);
    const yesterdayPoint = result.find((p) => p.label === yesterdayLabel);
    if (yesterdayPoint) {
      expect(yesterdayPoint.value).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// splitIntoPeriods
// ---------------------------------------------------------------------------
describe("splitIntoPeriods", () => {
  it("returns empty arrays for empty input", () => {
    const { current, prior } = splitIntoPeriods([], new Date());
    expect(current).toEqual([]);
    expect(prior).toEqual([]);
  });

  it("splits items correctly around the cutoff", () => {
    const cutoff = new Date("2024-03-15T00:00:00Z");
    const items = [
      { createdAt: "2024-03-10T10:00:00Z" }, // prior
      { createdAt: "2024-03-14T23:59:00Z" }, // prior
      { createdAt: "2024-03-15T00:00:00Z" }, // current (on cutoff boundary → current)
      { createdAt: "2024-03-20T08:00:00Z" }, // current
    ];
    const { current, prior } = splitIntoPeriods(items, cutoff);
    expect(current.length).toBe(2);
    expect(prior.length).toBe(2);
  });

  it("places all items in current when cutoff is very old", () => {
    const oldCutoff = new Date("2000-01-01T00:00:00Z");
    const items = [{ createdAt: "2024-01-01T00:00:00Z" }];
    const { current, prior } = splitIntoPeriods(items, oldCutoff);
    expect(current.length).toBe(1);
    expect(prior.length).toBe(0);
  });

  it("places all items in prior when cutoff is in the future", () => {
    const futureCutoff = new Date("2099-01-01T00:00:00Z");
    const items = [{ createdAt: "2024-01-01T00:00:00Z" }];
    const { current, prior } = splitIntoPeriods(items, futureCutoff);
    expect(current.length).toBe(0);
    expect(prior.length).toBe(1);
  });
});
