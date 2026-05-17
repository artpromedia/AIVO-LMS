import { describe, it, expect } from "vitest";
import type { Activity } from "@aivo/content-pack";
import {
  transformActivity,
  transformToSupported,
  transformToLowVerbal,
  transformToNonVerbal,
  transformToPreSymbolic,
  isDownhill,
  FUNCTIONING_LEVEL_ORDER,
} from "../index.js";

const baseMC: Activity = {
  id: "mc-1",
  title: "Counting apples",
  skillId: "ccss.math.k.cc.b.4",
  type: "multiple_choice",
  prompt: "How many apples are on the tree?",
  difficulty: "core",
  choices: [
    { id: "a", label: "Three apples on the tree", correct: false },
    { id: "b", label: "Four apples on the tree", correct: true },
    { id: "c", label: "Five apples on the tree", correct: false },
    { id: "d", label: "Six apples on the tree", correct: false },
  ],
};

const baseVoice: Activity = {
  id: "v-1",
  title: "Say the word",
  skillId: "ccss.math.k.cc.a.1",
  type: "voice",
  prompt: "Say the number you see.",
  difficulty: "intro",
  expectedAnswer: "five|5",
};

const baseDragDrop: Activity = {
  id: "dd-1",
  title: "Sort the shapes",
  skillId: "ccss.math.k.g.b.4",
  type: "drag_drop",
  prompt: "Drag the circle into the matching outline.",
  difficulty: "stretch",
  choices: [{ id: "circle", label: "Circle", value: "circle-zone" }],
};

describe("FUNCTIONING_LEVEL_ORDER", () => {
  it("matches the canonical 5-step ladder", () => {
    expect(FUNCTIONING_LEVEL_ORDER).toEqual([
      "STANDARD",
      "SUPPORTED",
      "LOW_VERBAL",
      "NON_VERBAL",
      "PRE_SYMBOLIC",
    ]);
  });
  it("isDownhill rejects same-level and uphill transforms", () => {
    expect(isDownhill("STANDARD", "STANDARD")).toBe(false);
    expect(isDownhill("PRE_SYMBOLIC", "STANDARD")).toBe(false);
    expect(isDownhill("STANDARD", "LOW_VERBAL")).toBe(true);
  });
});

describe("transformToSupported", () => {
  it("clamps maxOnScreenChoices to ≤3 and turns on subtitles", () => {
    const out = transformToSupported(baseMC);
    expect(out.adaptations?.maxOnScreenChoices).toBe(3);
    expect(out.adaptations?.forceSubtitles).toBe(true);
    expect(out.adaptations?.extraThinkingTimeMs).toBeGreaterThanOrEqual(4_000);
    expect(out.tags).toContain("level:supported");
  });
  it("preserves activity type and choices", () => {
    const out = transformToSupported(baseMC);
    expect(out.type).toBe("multiple_choice");
    expect(out.choices?.length).toBe(4);
  });
});

describe("transformToLowVerbal", () => {
  it("rewrites a `voice` activity into a `tap` over the first variant", () => {
    const out = transformToLowVerbal(baseVoice);
    expect(out.type).toBe("tap");
    expect(out.expectedAnswer).toBeUndefined();
    expect(out.choices?.[0].label).toBe("five");
    expect(out.choices?.[0].correct).toBe(true);
  });
  it("shortens long choice labels", () => {
    const out = transformToLowVerbal(baseMC);
    expect(out.choices?.every((c) => c.label.length <= 18)).toBe(true);
    // Correct flag must survive shortening.
    expect(out.choices?.find((c) => c.correct)).toBeDefined();
  });
  it("clamps onscreen choices to 2", () => {
    const out = transformToLowVerbal(baseMC);
    expect(out.adaptations?.maxOnScreenChoices).toBe(2);
  });
});

describe("transformToNonVerbal", () => {
  it("recasts `drag_drop` as a yes/no `tap`", () => {
    const out = transformToNonVerbal(baseDragDrop);
    expect(out.type).toBe("tap");
    expect(out.choices?.length).toBe(2);
    expect(out.choices?.find((c) => c.correct)?.label).toBe("Yes");
    expect(out.adaptations?.reducedMotion).toBe(true);
  });
  it("clamps multi-choice to exactly 2 (correct + first distractor)", () => {
    const out = transformToNonVerbal(baseMC);
    expect(out.choices?.length).toBe(2);
    expect(out.choices?.filter((c) => c.correct).length).toBe(1);
  });
});

describe("transformToPreSymbolic", () => {
  it("collapses to a single tap target with no correctness", () => {
    const out = transformToPreSymbolic(baseMC);
    expect(out.type).toBe("tap");
    expect(out.choices).toEqual([{ id: "go", label: "▶" }]);
    expect(out.expectedAnswer).toBeUndefined();
    expect(out.tags).toContain("level:pre_symbolic");
    expect(out.tags).toContain("score:observational");
  });
});

describe("transformActivity (composition)", () => {
  it("STANDARD is a no-op apart from default-adaptation merge", () => {
    const out = transformActivity(baseMC, "STANDARD");
    expect(out).toEqual(baseMC);
  });
  it("STANDARD with defaults merges into adaptations", () => {
    const out = transformActivity(baseMC, "STANDARD", {
      defaultAdaptations: { reducedMotion: true },
    });
    expect(out.adaptations?.reducedMotion).toBe(true);
  });
  it("composes through the ladder all the way to PRE_SYMBOLIC", () => {
    const out = transformActivity(baseMC, "PRE_SYMBOLIC");
    expect(out.type).toBe("tap");
    expect(out.choices?.length).toBe(1);
    expect(out.tags).toContain("level:pre_symbolic");
    // The intermediate "level:supported"/"level:low_verbal"/"level:non_verbal"
    // tags are dropped as we descend so we don't accumulate stale labels.
    expect(out.tags).not.toContain("level:supported");
    expect(out.tags).not.toContain("level:low_verbal");
    expect(out.tags).not.toContain("level:non_verbal");
  });
  it("LOW_VERBAL stops short — does not collapse to yes/no", () => {
    const out = transformActivity(baseMC, "LOW_VERBAL");
    expect(out.type).toBe("multiple_choice");
    expect(out.tags).toContain("level:low_verbal");
  });
  it("transforms voice activities through the ladder cleanly", () => {
    const out = transformActivity(baseVoice, "NON_VERBAL");
    expect(out.type).toBe("tap");
    expect(out.expectedAnswer).toBeUndefined();
    // Voice → tap conversion already happened at LOW_VERBAL; NON_VERBAL
    // then clamps it to 2 choices.
    expect(out.choices?.length).toBeLessThanOrEqual(2);
  });
});
