import { describe, it, expect } from "vitest";
import {
  coerceA11y,
  coerceAudio,
  clampSpeed,
  clampBreakInterval,
  scaleFont,
  TEXT_SCALE_FACTOR,
  DEFAULT_A11Y,
  DEFAULT_AUDIO,
  MIN_SPEED,
  MAX_SPEED,
  MIN_BREAK_INTERVAL,
  MAX_BREAK_INTERVAL,
  resolveLessonAccommodations,
} from "../lib/preferences-logic";

describe("resolveLessonAccommodations", () => {
  it("enables read-aloud only when both the a11y default and TTS master are on", () => {
    const on = resolveLessonAccommodations(
      { ...DEFAULT_A11Y, readAloudDefault: true },
      { ...DEFAULT_AUDIO, ttsEnabled: true },
    );
    expect(on.readAloud).toBe(true);
    const ttsOff = resolveLessonAccommodations(
      { ...DEFAULT_A11Y, readAloudDefault: true },
      { ...DEFAULT_AUDIO, ttsEnabled: false },
    );
    expect(ttsOff.readAloud).toBe(false);
    const prefOff = resolveLessonAccommodations(
      { ...DEFAULT_A11Y, readAloudDefault: false },
      { ...DEFAULT_AUDIO, ttsEnabled: true },
    );
    expect(prefOff.readAloud).toBe(false);
  });

  it("passes through captions, reduced motion, and text scale", () => {
    const r = resolveLessonAccommodations(
      { ...DEFAULT_A11Y, reduceMotion: true, textScale: "large", captionsDefault: true },
      DEFAULT_AUDIO,
    );
    expect(r.captionsAlwaysOn).toBe(true);
    expect(r.reducedMotion).toBe(true);
    expect(r.textScale).toBe("large");
  });

  it("surfaces extended time only when the IEP flag is set", () => {
    expect(resolveLessonAccommodations(DEFAULT_A11Y, DEFAULT_AUDIO).extendedTime).toBe(false);
    expect(
      resolveLessonAccommodations(DEFAULT_A11Y, DEFAULT_AUDIO, { extendedTime: true }).extendedTime,
    ).toBe(true);
  });
});

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
      dyslexiaFriendlyFont: false,
      breakReminders: false,
      breakIntervalMinutes: 10,
    });
  });

  it("coerceA11y handles dyslexia font + break reminders and clamps the interval", () => {
    expect(coerceA11y({ dyslexiaFriendlyFont: true }).dyslexiaFriendlyFont).toBe(true);
    expect(coerceA11y({ dyslexiaFriendlyFont: "yes" }).dyslexiaFriendlyFont).toBe(false);
    expect(coerceA11y({ breakReminders: true }).breakReminders).toBe(true);
    expect(coerceA11y({ breakIntervalMinutes: 1 }).breakIntervalMinutes).toBe(MIN_BREAK_INTERVAL);
    expect(coerceA11y({ breakIntervalMinutes: 999 }).breakIntervalMinutes).toBe(MAX_BREAK_INTERVAL);
    expect(coerceA11y({ breakIntervalMinutes: 15 }).breakIntervalMinutes).toBe(15);
  });

  it("clampBreakInterval keeps values in range and tolerates NaN", () => {
    expect(clampBreakInterval(10)).toBe(10);
    expect(clampBreakInterval(1)).toBe(MIN_BREAK_INTERVAL);
    expect(clampBreakInterval(99)).toBe(MAX_BREAK_INTERVAL);
    expect(clampBreakInterval(Number.NaN)).toBe(DEFAULT_A11Y.breakIntervalMinutes);
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
