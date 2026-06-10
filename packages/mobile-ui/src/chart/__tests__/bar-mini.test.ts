import { describe, it, expect } from "vitest";
import {
  barFillRatios,
  buildBarMiniLabel,
  type BarItem,
} from "../chartHelpers";

const SAMPLE_BARS: BarItem[] = [
  { label: "Math", value: 80, maxValue: 100 },
  { label: "ELA", value: 75, maxValue: 100 },
  { label: "Science", value: 90, maxValue: 100 },
];

describe("barFillRatios", () => {
  it("returns an empty array for no bars", () => {
    expect(barFillRatios([])).toEqual([]);
  });

  it("computes correct 0..1 ratios for standard inputs", () => {
    const ratios = barFillRatios(SAMPLE_BARS);
    expect(ratios).toHaveLength(3);
    expect(ratios[0]).toBeCloseTo(0.8);
    expect(ratios[1]).toBeCloseTo(0.75);
    expect(ratios[2]).toBeCloseTo(0.9);
  });

  it("clamps ratio to 1 when value exceeds maxValue", () => {
    const bars: BarItem[] = [{ label: "Over", value: 110, maxValue: 100 }];
    expect(barFillRatios(bars)[0]).toBe(1);
  });

  it("returns 0 for zero values", () => {
    const bars: BarItem[] = [{ label: "Zero", value: 0, maxValue: 100 }];
    expect(barFillRatios(bars)[0]).toBe(0);
  });

  it("returns 0 when maxValue is 0 (avoids division by zero)", () => {
    const bars: BarItem[] = [{ label: "Bad", value: 50, maxValue: 0 }];
    expect(barFillRatios(bars)[0]).toBe(0);
  });

  it("returns 0 when maxValue is negative", () => {
    const bars: BarItem[] = [{ label: "Neg", value: 50, maxValue: -10 }];
    expect(barFillRatios(bars)[0]).toBe(0);
  });

  it("handles a single bar correctly", () => {
    const bars: BarItem[] = [{ label: "Only", value: 50, maxValue: 100 }];
    expect(barFillRatios(bars)[0]).toBeCloseTo(0.5);
  });

  it("produces ratios proportional to bar values", () => {
    const bars: BarItem[] = [
      { label: "A", value: 25, maxValue: 100 },
      { label: "B", value: 50, maxValue: 100 },
    ];
    const ratios = barFillRatios(bars);
    // B should be exactly double A
    expect(ratios[1] / ratios[0]).toBeCloseTo(2);
  });
});

describe("buildBarMiniLabel", () => {
  it("returns a no-data label for empty bars", () => {
    expect(buildBarMiniLabel([])).toBe("Subjects: no data");
  });

  it("uses the provided subject in the label", () => {
    const label = buildBarMiniLabel(SAMPLE_BARS, "Mastery");
    expect(label).toMatch(/^Mastery:/);
  });

  it("includes all bar labels with percentages", () => {
    const label = buildBarMiniLabel(SAMPLE_BARS, "Subjects mastery");
    expect(label).toContain("Math 80%");
    expect(label).toContain("ELA 75%");
    expect(label).toContain("Science 90%");
  });

  it("rounds decimal percentages", () => {
    const bars: BarItem[] = [{ label: "X", value: 1, maxValue: 3 }];
    // 1/3 ≈ 33.33% → rounds to 33%
    const label = buildBarMiniLabel(bars);
    expect(label).toContain("33%");
  });

  it("shows 0% when value is 0", () => {
    const bars: BarItem[] = [{ label: "Zero", value: 0, maxValue: 100 }];
    const label = buildBarMiniLabel(bars);
    expect(label).toContain("0%");
  });

  it("shows 0% when maxValue is 0 (avoids NaN)", () => {
    const bars: BarItem[] = [{ label: "Bad", value: 50, maxValue: 0 }];
    const label = buildBarMiniLabel(bars);
    expect(label).toContain("0%");
  });
});
