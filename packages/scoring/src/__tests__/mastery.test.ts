import { describe, expect, it } from "vitest";
import {
  masteryLevelFromScore,
  masteryTargetFromOutcome,
  moveMasteryScore,
} from "../mastery.js";

describe("masteryLevelFromScore (canonical web bucketing)", () => {
  it("buckets at the exact thresholds", () => {
    expect(masteryLevelFromScore(0)).toBe("not_started");
    expect(masteryLevelFromScore(0.149)).toBe("not_started");
    expect(masteryLevelFromScore(0.15)).toBe("emerging");
    expect(masteryLevelFromScore(0.399)).toBe("emerging");
    expect(masteryLevelFromScore(0.4)).toBe("approaching");
    expect(masteryLevelFromScore(0.649)).toBe("approaching");
    expect(masteryLevelFromScore(0.65)).toBe("on_grade_level");
    expect(masteryLevelFromScore(0.899)).toBe("on_grade_level");
    expect(masteryLevelFromScore(0.9)).toBe("stretching");
    expect(masteryLevelFromScore(1)).toBe("stretching");
  });
});

describe("masteryTargetFromOutcome", () => {
  const base = { checksTotal: 4, checksCorrect: 4, hintsUsed: 0, scaffoldsUsed: 0, abandoned: false };

  it("uses raw accuracy with no support", () => {
    expect(masteryTargetFromOutcome(base, 0.4)).toBe(1);
    expect(masteryTargetFromOutcome({ ...base, checksCorrect: 2 }, 0.4)).toBe(0.5);
  });

  it("defaults to 0.5 for intro-only runs (no checks)", () => {
    expect(masteryTargetFromOutcome({ ...base, checksTotal: 0, checksCorrect: 0 }, 0.4)).toBe(0.5);
  });

  it("discounts hints/scaffolds, capped at 0.15", () => {
    expect(masteryTargetFromOutcome({ ...base, hintsUsed: 2 }, 0.4)).toBeCloseTo(0.92, 5);
    expect(masteryTargetFromOutcome({ ...base, scaffoldsUsed: 1 }, 0.4)).toBeCloseTo(0.95, 5);
    expect(masteryTargetFromOutcome({ ...base, hintsUsed: 10, scaffoldsUsed: 10 }, 0.4)).toBeCloseTo(0.85, 5);
  });

  it("abandoned runs decay toward min(before, 0.5)", () => {
    expect(masteryTargetFromOutcome({ ...base, abandoned: true }, 0.8)).toBe(0.5);
    expect(masteryTargetFromOutcome({ ...base, abandoned: true }, 0.3)).toBe(0.3);
  });
});

describe("moveMasteryScore", () => {
  it("moves 25% toward the target with clamping", () => {
    expect(moveMasteryScore(0.4, 1)).toBeCloseTo(0.55, 5);
    expect(moveMasteryScore(0.55, 1)).toBeCloseTo(0.6625, 5);
    expect(moveMasteryScore(0.55, 0.5)).toBeCloseTo(0.5375, 5);
    expect(moveMasteryScore(0, 0)).toBe(0);
    expect(moveMasteryScore(1, 1)).toBe(1);
  });
});
