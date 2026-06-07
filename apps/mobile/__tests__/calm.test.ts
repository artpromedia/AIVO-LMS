/**
 * Calm Corner catalog + selectors — mobile port parity.
 *
 * Mirrors apps/web-v2/lib/learner/__tests__/calm.test.ts so the mobile
 * catalog can never silently drift from the web contract. Pure logic only,
 * runs in the node vitest environment.
 */
import { describe, expect, it } from "vitest";
import {
  getCalmCatalog,
  getCalmActivity,
  isCalmActivityId,
  recommendCalmActivity,
  affirmationKeyFor,
  boxBreathRounds,
  BOX_BREATH_PHASES,
  BOX_BREATH_PHASE_SECONDS,
  type CalmActivityId,
} from "../lib/calm";

describe("calm catalog", () => {
  it("exposes a stable, non-empty, unique catalog", () => {
    const catalog = getCalmCatalog();
    expect(catalog.length).toBeGreaterThan(0);
    const ids = catalog.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("orders the universal breathing option first", () => {
    expect(getCalmCatalog()[0].id).toBe("box_breathing");
  });

  it("includes the Pattern and Sorting grounding activities", () => {
    const byId = new Map(getCalmCatalog().map((a) => [a.id, a]));
    for (const id of ["pattern_focus", "sorting_calm"] as const) {
      const activity = byId.get(id);
      expect(activity).toBeDefined();
      expect(activity!.kind).toBe("grounding");
      expect(activity!.durationSeconds).toBe(0);
      expect(activity!.motionSafe).toBe(true);
    }
  });

  it("every activity resolves and is total over its fields", () => {
    for (const a of getCalmCatalog()) {
      const got = getCalmActivity(a.id);
      expect(got.id).toBe(a.id);
      expect(typeof got.titleKey).toBe("string");
      expect(typeof got.bodyKey).toBe("string");
      expect(got.durationSeconds).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("isCalmActivityId", () => {
  it("accepts known ids and rejects everything else", () => {
    expect(isCalmActivityId("box_breathing")).toBe(true);
    expect(isCalmActivityId("nope")).toBe(false);
    expect(isCalmActivityId(42)).toBe(false);
    expect(isCalmActivityId(null)).toBe(false);
  });
});

describe("recommendCalmActivity", () => {
  it.each([
    ["simplify_step", "smaller_step"],
    ["switch_surface", "switch_to_drawing"],
    ["parent_support", "ask_grown_up"],
    ["micro_hint", "listen_again"],
    ["offer_break", "box_breathing"],
  ] as const)("maps %s -> %s", (action, expected) => {
    expect(recommendCalmActivity(action)).toBe(expected);
  });

  it("falls back to box breathing for unknown/empty actions", () => {
    expect(recommendCalmActivity(null)).toBe("box_breathing");
    expect(recommendCalmActivity(undefined)).toBe("box_breathing");
    expect(recommendCalmActivity("anything-else")).toBe("box_breathing");
  });
});

describe("affirmationKeyFor", () => {
  it("returns a key for every catalog activity", () => {
    for (const a of getCalmCatalog()) {
      expect(affirmationKeyFor(a.id as CalmActivityId)).toMatch(
        /calmer|refreshed|ready|supported/,
      );
    }
  });
});

describe("box breathing math", () => {
  it("derives a whole number of rounds from the configured duration", () => {
    const rounds = boxBreathRounds();
    expect(Number.isInteger(rounds)).toBe(true);
    expect(rounds).toBeGreaterThan(0);
    expect(rounds * BOX_BREATH_PHASES.length * BOX_BREATH_PHASE_SECONDS).toBe(
      getCalmActivity("box_breathing").durationSeconds,
    );
  });
});
