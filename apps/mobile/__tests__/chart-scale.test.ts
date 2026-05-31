import { describe, it, expect } from "vitest";
import {
  clamp,
  normalizeScore,
  masteryLevelFromScore,
  masteryLevelFromLabel,
  chartBounds,
  valueRatios,
  barRatios,
  takeRecent,
  type ChartPoint,
} from "../src/design/chart-scale";

describe("chart-scale", () => {
  it("clamps into range", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-2, 0, 1)).toBe(0);
    expect(clamp(0.4, 0, 1)).toBe(0.4);
  });

  it("normalizes 0..1 and 0..100 scores to 0..1", () => {
    expect(normalizeScore(0.42)).toBeCloseTo(0.42);
    expect(normalizeScore(42)).toBeCloseTo(0.42);
    expect(normalizeScore(150)).toBe(1);
    expect(normalizeScore(Number.NaN)).toBe(0);
  });

  it("maps scores to mastery levels at the documented thresholds", () => {
    expect(masteryLevelFromScore(0.2)).toBe("emerging");
    expect(masteryLevelFromScore(0.35)).toBe("developing");
    expect(masteryLevelFromScore(0.59)).toBe("developing");
    expect(masteryLevelFromScore(0.6)).toBe("proficient");
    expect(masteryLevelFromScore(0.84)).toBe("proficient");
    expect(masteryLevelFromScore(0.85)).toBe("mastered");
    // accepts 0..100 too
    expect(masteryLevelFromScore(90)).toBe("mastered");
  });

  it("maps web string levels onto the chart scale", () => {
    expect(masteryLevelFromLabel("stretching")).toBe("mastered");
    expect(masteryLevelFromLabel("on_grade_level")).toBe("proficient");
    expect(masteryLevelFromLabel("approaching")).toBe("developing");
    expect(masteryLevelFromLabel("not_started")).toBe("emerging");
  });

  it("computes bounds with headroom and handles flat/empty series", () => {
    expect(chartBounds([])).toEqual({ min: 0, max: 1 });
    const flat = chartBounds([
      { label: "a", value: 3 },
      { label: "b", value: 3 },
    ]);
    expect(flat.min).toBeLessThan(3);
    expect(flat.max).toBeGreaterThan(3);
  });

  it("produces value ratios within 0..1 and 0.5 for flat series", () => {
    const flat: ChartPoint[] = [
      { label: "a", value: 2 },
      { label: "b", value: 2 },
    ];
    expect(valueRatios(flat)).toEqual([0.5, 0.5]);
    const varied: ChartPoint[] = [
      { label: "a", value: 0 },
      { label: "b", value: 10 },
    ];
    const r = valueRatios(varied);
    expect(r[0]).toBeGreaterThanOrEqual(0);
    expect(r[1]).toBeLessThanOrEqual(1);
    expect(r[1]).toBeGreaterThan(r[0]);
  });

  it("anchors bar ratios at zero relative to the max", () => {
    const data: ChartPoint[] = [
      { label: "a", value: 0 },
      { label: "b", value: 5 },
      { label: "c", value: 10 },
    ];
    expect(barRatios(data)).toEqual([0, 0.5, 1]);
    expect(barRatios([{ label: "z", value: 0 }])).toEqual([0]);
  });

  it("keeps the most recent slots when collapsing a long series", () => {
    expect(takeRecent([1, 2, 3, 4, 5], 3)).toEqual([3, 4, 5]);
    expect(takeRecent([1, 2], 5)).toEqual([1, 2]);
    expect(takeRecent([1, 2, 3], 0)).toEqual([1, 2, 3]);
  });
});
