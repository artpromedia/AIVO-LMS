import { describe, it, expect } from "vitest";
import {
  coerceA11y,
  coerceAudio,
  clampSpeed,
  scaleFont,
  TEXT_SCALE_FACTOR,
  DEFAULT_A11Y,
  DEFAULT_AUDIO,
  MIN_SPEED,
  MAX_SPEED,
} from "../lib/preferences-logic";

describe("preferences-logic", () => {
  it("coerceA11y fills defaults and rejects bad values", () => {
    expect(coerceA11y(null)).toEqual(DEFAULT_A11Y);
    expect(coerceA11y({})).toEqual(DEFAULT_A11Y);
    expect(coerceA11y({ textScale: "huge" }).textScale).toBe("medium");
    expect(coerceA11y({ reduceMotion: "yes" }).reduceMotion).toBe(false);
    expect(coerceA11y({ reduceMotion: true, textScale: "large", readAloudDefault: true })).toEqual({
      reduceMotion: true,
      textScale: "large",
      readAloudDefault: true,
      captionsDefault: false,
    });
  });

  it("coerceAudio validates voice + clamps speed", () => {
    expect(coerceAudio(null)).toEqual(DEFAULT_AUDIO);
    expect(coerceAudio({ voiceId: "not_a_voice" }).voiceId).toBe("kid_friendly");
    expect(coerceAudio({ voiceId: "warm_male" }).voiceId).toBe("warm_male");
    expect(coerceAudio({ speed: 5 }).speed).toBe(MAX_SPEED);
    expect(coerceAudio({ speed: 0.1 }).speed).toBe(MIN_SPEED);
    expect(coerceAudio({ ttsEnabled: false }).ttsEnabled).toBe(false);
  });

  it("clampSpeed keeps values in range and tolerates NaN", () => {
    expect(clampSpeed(1)).toBe(1);
    expect(clampSpeed(99)).toBe(MAX_SPEED);
    expect(clampSpeed(-1)).toBe(MIN_SPEED);
    expect(clampSpeed(Number.NaN)).toBe(DEFAULT_AUDIO.speed);
  });

  it("scaleFont applies the text-scale factor", () => {
    expect(scaleFont(20, "medium")).toBe(20);
    expect(scaleFont(20, "small")).toBe(20 * TEXT_SCALE_FACTOR.small);
    expect(scaleFont(20, "large")).toBe(20 * TEXT_SCALE_FACTOR.large);
  });
});
