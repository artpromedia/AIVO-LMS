import { describe, it, expect } from "vitest";
import { distribution, BAND_ORDER } from "../lib/mastery-distribution";

describe("mastery-distribution", () => {
  it("returns an empty distribution for no learners", () => {
    const d = distribution([]);
    expect(d.total).toBe(0);
    expect(d.average).toBe(0);
    expect(BAND_ORDER.every((b) => d.bands[b] === 0)).toBe(true);
  });

  it("buckets learners into the four bands and averages", () => {
    const d = distribution([
      { learnerId: "a", overall: 0.9 }, // mastered -> stretching
      { learnerId: "b", overall: 0.7 }, // proficient -> onGrade
      { learnerId: "c", overall: 0.45 }, // developing -> approaching
      { learnerId: "d", overall: 0.2 }, // emerging
    ]);
    expect(d.bands).toEqual({ stretching: 1, onGrade: 1, approaching: 1, emerging: 1 });
    expect(d.total).toBe(4);
    expect(d.average).toBe(Math.round((90 + 70 + 45 + 20) / 4));
  });

  it("accepts 0..100 scores too", () => {
    const d = distribution([{ learnerId: "a", overall: 88 }]);
    expect(d.bands.stretching).toBe(1);
    expect(d.average).toBe(88);
  });
});
