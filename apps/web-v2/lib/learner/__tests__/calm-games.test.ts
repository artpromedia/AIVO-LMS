/**
 * Calming mini-game pure logic — deterministic with a seeded rng.
 */
import { describe, expect, it } from "vitest";
import {
  PATTERN_TILE_COUNT,
  generatePatternSequence,
  isPatternGuessCorrect,
  generateSortingItems,
  isSortingSolved,
  type SortItem,
} from "../calm";

/** A simple, deterministic LCG so tests don't depend on Math.random. */
function seededRng(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

describe("generatePatternSequence", () => {
  it("is deterministic for a given rng seed", () => {
    const a = generatePatternSequence(seededRng(42), 6);
    const b = generatePatternSequence(seededRng(42), 6);
    expect(a).toEqual(b);
  });

  it("produces the requested length with every tile in range", () => {
    const seq = generatePatternSequence(seededRng(7), 10);
    expect(seq).toHaveLength(10);
    for (const tile of seq) {
      expect(Number.isInteger(tile)).toBe(true);
      expect(tile).toBeGreaterThanOrEqual(0);
      expect(tile).toBeLessThan(PATTERN_TILE_COUNT);
    }
  });

  it("clamps a non-positive or fractional length safely", () => {
    expect(generatePatternSequence(seededRng(1), 0)).toEqual([]);
    expect(generatePatternSequence(seededRng(1), -5)).toEqual([]);
    expect(generatePatternSequence(seededRng(1), 3.9)).toHaveLength(3);
  });
});

describe("isPatternGuessCorrect", () => {
  it("is true only on an exact match", () => {
    expect(isPatternGuessCorrect([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  it("is false on wrong order, wrong value, or wrong length", () => {
    expect(isPatternGuessCorrect([1, 2, 3], [1, 3, 2])).toBe(false);
    expect(isPatternGuessCorrect([1, 2, 3], [1, 2, 0])).toBe(false);
    expect(isPatternGuessCorrect([1, 2, 3], [1, 2])).toBe(false);
    expect(isPatternGuessCorrect([1, 2, 3], [1, 2, 3, 0])).toBe(false);
  });

  it("treats two empty sequences as a match", () => {
    expect(isPatternGuessCorrect([], [])).toBe(true);
  });
});

describe("generateSortingItems", () => {
  it("is deterministic and contains exactly values 1..count", () => {
    const a = generateSortingItems(seededRng(99), 5);
    const b = generateSortingItems(seededRng(99), 5);
    expect(a).toEqual(b);
    expect(a.map((i) => i.value).sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(a.map((i) => i.id)).size).toBe(5);
  });

  it("clamps a non-positive count to an empty tray", () => {
    expect(generateSortingItems(seededRng(1), 0)).toEqual([]);
    expect(generateSortingItems(seededRng(1), -3)).toEqual([]);
  });
});

describe("isSortingSolved", () => {
  const item = (value: number): SortItem => ({ id: `sort_${value}`, value });

  it("is true for a non-decreasing arrangement", () => {
    expect(isSortingSolved([item(1), item(2), item(3)])).toBe(true);
    expect(isSortingSolved([item(1)])).toBe(true);
    expect(isSortingSolved([])).toBe(true);
  });

  it("is false for any out-of-order permutation", () => {
    expect(isSortingSolved([item(2), item(1), item(3)])).toBe(false);
    expect(isSortingSolved([item(3), item(2), item(1)])).toBe(false);
    expect(isSortingSolved([item(1), item(3), item(2)])).toBe(false);
  });
});
