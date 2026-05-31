import { describe, it, expect } from "vitest";
import { summarizeDomains } from "../lib/learner-progress";

describe("learner-progress.summarizeDomains", () => {
  it("returns a zeroed summary for no domains", () => {
    expect(summarizeDomains([])).toEqual({
      overallMastery: 0,
      masteredCount: 0,
      needsSupportCount: 0,
      onTrackCount: 0,
      total: 0,
      subjects: [],
    });
  });

  it("buckets domains by mastery level and averages overall", () => {
    const s = summarizeDomains([
      { domain: "Math", masteryPercent: 90 }, // mastered
      { domain: "Reading", masteryPercent: 70 }, // proficient -> on track
      { domain: "Science", masteryPercent: 45 }, // developing -> on track
      { domain: "Writing", masteryPercent: 20 }, // emerging -> needs support
    ]);
    expect(s.masteredCount).toBe(1);
    expect(s.needsSupportCount).toBe(1);
    expect(s.onTrackCount).toBe(2);
    expect(s.total).toBe(4);
    expect(s.overallMastery).toBe(Math.round((90 + 70 + 45 + 20) / 4));
  });

  it("sorts subjects strongest-first and clamps percentages", () => {
    const s = summarizeDomains([
      { domain: "Low", masteryPercent: 10 },
      { domain: "High", masteryPercent: 120 },
      { domain: "Mid", masteryPercent: 55 },
    ]);
    expect(s.subjects.map((x) => x.name)).toEqual(["High", "Mid", "Low"]);
    expect(s.subjects[0].mastery).toBe(100); // clamped
  });
});
