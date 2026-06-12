import { describe, expect, it } from "vitest";
import { masteryStageKey } from "./mastery-words";

describe("masteryStageKey", () => {
  it("maps band edges to the friendly stages", () => {
    expect(masteryStageKey(0)).toBe("mastery_not_started");
    expect(masteryStageKey(0.01)).toBe("mastery_just_starting");
    expect(masteryStageKey(0.4)).toBe("mastery_building");
    expect(masteryStageKey(0.65)).toBe("mastery_on_grade");
    expect(masteryStageKey(0.85)).toBe("mastery_strong");
    expect(masteryStageKey(1)).toBe("mastery_strong");
  });
});
