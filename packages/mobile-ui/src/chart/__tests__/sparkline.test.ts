import { describe, it, expect } from "vitest";
import {
  sparklinePoints,
  buildSparklineLabel,
  sparklineTrendText,
} from "../chartHelpers";

describe("sparklinePoints", () => {
  it("returns empty string for an empty series", () => {
    expect(sparklinePoints([])).toBe("");
  });

  it("returns a flat midline for a single-point series", () => {
    const result = sparklinePoints([5]);
    // Single point should produce two coordinates on the midline
    expect(result).toBe("0,20 100,20");
  });

  it("returns two SVG coordinate pairs for a two-point series", () => {
    const result = sparklinePoints([0, 10]);
    const pairs = result.split(" ");
    expect(pairs).toHaveLength(2);
    // First point should be at x=0, last at x=100
    expect(pairs[0]).toMatch(/^0,/);
    expect(pairs[1]).toMatch(/^100,/);
  });

  it("maps values so the maximum is at the top (low y) and minimum at bottom (high y)", () => {
    const result = sparklinePoints([0, 10], 100, 40, 4);
    const pairs = result.split(" ").map((p) => {
      const [x, y] = p.split(",").map(Number);
      return { x, y };
    });
    // First value (0 = min) should be at the bottom (higher y)
    // Last value (10 = max) should be at the top (lower y)
    expect(pairs[0].y).toBeGreaterThan(pairs[1].y);
  });

  it("handles all-equal values without crashing", () => {
    const result = sparklinePoints([5, 5, 5, 5]);
    const pairs = result.split(" ");
    expect(pairs).toHaveLength(4);
    // All y values should be equal (flat line at midpoint)
    const ys = pairs.map((p) => parseFloat(p.split(",")[1]));
    expect(ys.every((y) => y === ys[0])).toBe(true);
  });

  it("produces the right number of coordinate pairs for a 7-point series", () => {
    const result = sparklinePoints([2, 3, 5, 4, 6, 7, 5]);
    const pairs = result.split(" ");
    expect(pairs).toHaveLength(7);
  });

  it("handles all-zero values", () => {
    const result = sparklinePoints([0, 0, 0]);
    expect(result).not.toBe("");
    const pairs = result.split(" ");
    expect(pairs).toHaveLength(3);
  });
});

describe("buildSparklineLabel", () => {
  it("describes empty series correctly", () => {
    expect(buildSparklineLabel([])).toBe("Trend: no data");
  });

  it("includes all values in the label", () => {
    const label = buildSparklineLabel([2, 3, 5], "Sessions over last 3 days");
    expect(label).toBe("Sessions over last 3 days: 2, 3, 5");
  });

  it("uses 'Trend' as the default label", () => {
    const label = buildSparklineLabel([1, 2]);
    expect(label).toMatch(/^Trend:/);
  });
});

describe("sparklineTrendText", () => {
  it("reports rising trend", () => {
    expect(sparklineTrendText([1, 2, 3])).toBe("Trend is rising");
  });

  it("reports falling trend", () => {
    expect(sparklineTrendText([3, 2, 1])).toBe("Trend is falling");
  });

  it("reports flat trend", () => {
    expect(sparklineTrendText([5, 5, 5])).toBe("Trend is flat");
  });

  it("handles insufficient data", () => {
    expect(sparklineTrendText([])).toBe("Insufficient data to determine trend");
    expect(sparklineTrendText([42])).toBe("Insufficient data to determine trend");
  });
});
