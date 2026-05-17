import { describe, it, expect } from "vitest";
import {
  validateContentPack,
  isContentPackValid,
  type ContentPack,
} from "../index.js";

function basePack(overrides: Partial<ContentPack> = {}): ContentPack {
  return {
    id: "k-math-fall-2026",
    title: "K Math (Fall 2026)",
    version: "1.0.0",
    schemaVersion: 1,
    subject: "math",
    gradeBand: "K",
    skillGraphRefs: ["ccss-math-k"],
    publisher: { name: "AIVO Curriculum Team" },
    license: "CC-BY-4.0",
    publishedAt: "2026-09-01T00:00:00Z",
    assets: [
      { id: "img-apple", kind: "image", src: "https://cdn.example/apple.png", alt: "A red apple" },
    ],
    activities: [
      {
        id: "a1",
        title: "Count the apples",
        skillId: "ccss-math.K.CC.B.5",
        type: "multiple_choice",
        prompt: "How many apples?",
        difficulty: "intro",
        assetRefs: ["img-apple"],
        choices: [
          { id: "c1", label: "2", correct: false },
          { id: "c2", label: "3", correct: true },
          { id: "c3", label: "4", correct: false },
        ],
      },
    ],
    ...overrides,
  };
}

describe("validateContentPack", () => {
  it("accepts a well-formed pack", () => {
    expect(validateContentPack(basePack())).toEqual([]);
    expect(isContentPackValid(basePack())).toBe(true);
  });

  it("rejects a pack with no activities", () => {
    const issues = validateContentPack(basePack({ activities: [] }));
    expect(issues.some((i) => i.code === "empty_pack")).toBe(true);
  });

  it("rejects unsupported schemaVersion", () => {
    const issues = validateContentPack(basePack({ schemaVersion: 2 as 1 }));
    expect(issues.some((i) => i.code === "unsupported_schema_version")).toBe(true);
  });

  it("rejects missing required pack fields", () => {
    const issues = validateContentPack(basePack({ license: "" }));
    expect(issues.some(
      (i) => i.code === "missing_required_field" && i.detail.includes("license"),
    )).toBe(true);
  });

  it("rejects duplicate activity ids", () => {
    const pack = basePack({
      activities: [
        ...basePack().activities,
        { ...basePack().activities[0] }, // identical id "a1"
      ],
    });
    expect(validateContentPack(pack).some((i) => i.code === "duplicate_activity_id")).toBe(true);
  });

  it("rejects duplicate asset ids", () => {
    const pack = basePack({
      assets: [
        { id: "img-apple", kind: "image", src: "https://x", alt: "a" },
        { id: "img-apple", kind: "image", src: "https://y", alt: "b" },
      ],
    });
    expect(validateContentPack(pack).some((i) => i.code === "duplicate_asset_id")).toBe(true);
  });

  it("rejects unknown asset references", () => {
    const pack = basePack({
      activities: [{ ...basePack().activities[0], assetRefs: ["does-not-exist"] }],
    });
    expect(validateContentPack(pack).some((i) => i.code === "unknown_asset_ref")).toBe(true);
  });

  it("requires alt text on image assets (WCAG)", () => {
    const pack = basePack({
      assets: [{ id: "img-apple", kind: "image", src: "https://x" }],
    });
    expect(validateContentPack(pack).some((i) => i.code === "missing_asset_alt")).toBe(true);
  });

  it("does not require alt text on audio assets", () => {
    const pack = basePack({
      assets: [{ id: "snd", kind: "audio", src: "https://x.mp3" }],
      activities: [{ ...basePack().activities[0], assetRefs: ["snd"] }],
    });
    expect(validateContentPack(pack).some((i) => i.code === "missing_asset_alt")).toBe(false);
  });

  it("flags multiple_choice with no correct answer", () => {
    const pack = basePack({
      activities: [{
        ...basePack().activities[0],
        choices: [
          { id: "c1", label: "2", correct: false },
          { id: "c2", label: "3", correct: false },
        ],
      }],
    });
    expect(validateContentPack(pack).some((i) => i.code === "no_correct_choice")).toBe(true);
  });

  it("flags multiple_choice with multiple correct answers", () => {
    const pack = basePack({
      activities: [{
        ...basePack().activities[0],
        choices: [
          { id: "c1", label: "2", correct: true },
          { id: "c2", label: "3", correct: true },
        ],
      }],
    });
    expect(
      validateContentPack(pack).some((i) => i.code === "multiple_correct_in_single_choice"),
    ).toBe(true);
  });

  it("voice activity must define expectedAnswer (empty string allowed for free practice)", () => {
    const missing = basePack({
      activities: [{
        id: "v1",
        title: "Say it",
        skillId: "ccss-math.K.CC.A.1",
        type: "voice",
        prompt: "Say a number you know",
        difficulty: "intro",
      }],
    });
    expect(validateContentPack(missing).some((i) => i.code === "voice_missing_expected")).toBe(true);

    const present = basePack({
      activities: [{
        id: "v2",
        title: "Say it",
        skillId: "ccss-math.K.CC.A.1",
        type: "voice",
        prompt: "Say a number you know",
        difficulty: "intro",
        expectedAnswer: "", // explicit empty = talking practice
      }],
    });
    expect(validateContentPack(present).some((i) => i.code === "voice_missing_expected")).toBe(false);
  });
});
