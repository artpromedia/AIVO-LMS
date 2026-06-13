import { describe, expect, it } from "vitest";
import {
  AAC_INPUT_METHODS,
  ACCESSIBILITY_DEFAULTS,
  ACCESSIBILITY_FIELDS,
  VOICE_IDS,
  clampBreakIntervalMinutes,
  clampScanDelayMs,
  clampTtsSpeed,
  DEFAULT_AAC_SCAN_DELAY_MS,
  MAX_AAC_SCAN_DELAY_MS,
  MIN_AAC_SCAN_DELAY_MS,
  MAX_BREAK_INTERVAL_MINUTES,
  MIN_BREAK_INTERVAL_MINUTES,
  accessibilityProfileToCssVars,
  LEARNER_PREF_CSS_VARS,
  LEARNER_PREF_SCALE,
} from "./index";

describe("accessibility contract — primitives", () => {
  it("declares the canonical AAC methods + 6 voices", () => {
    expect(AAC_INPUT_METHODS).toContain("eye_gaze");
    expect(VOICE_IDS).toHaveLength(6);
    expect(VOICE_IDS).toContain("kid_friendly");
  });

  it("defaults cover every declared field exactly", () => {
    expect(Object.keys(ACCESSIBILITY_DEFAULTS).sort()).toEqual([...ACCESSIBILITY_FIELDS].sort());
    expect(ACCESSIBILITY_DEFAULTS.aacInputMethod).toBe("touch");
    expect(ACCESSIBILITY_DEFAULTS.aacScanDelayMs).toBe(DEFAULT_AAC_SCAN_DELAY_MS);
  });

  it("clamps scan delay to bounds and tolerates NaN", () => {
    expect(clampScanDelayMs(100)).toBe(MIN_AAC_SCAN_DELAY_MS);
    expect(clampScanDelayMs(99_999)).toBe(MAX_AAC_SCAN_DELAY_MS);
    expect(clampScanDelayMs(1500)).toBe(1500);
    expect(clampScanDelayMs(Number.NaN)).toBe(DEFAULT_AAC_SCAN_DELAY_MS);
  });

  it("clamps break interval to bounds", () => {
    expect(clampBreakIntervalMinutes(1)).toBe(MIN_BREAK_INTERVAL_MINUTES);
    expect(clampBreakIntervalMinutes(999)).toBe(MAX_BREAK_INTERVAL_MINUTES);
    expect(clampBreakIntervalMinutes(10)).toBe(10);
  });

  it("clamps TTS speed to bounds", () => {
    expect(clampTtsSpeed(0.1)).toBe(0.5);
    expect(clampTtsSpeed(9)).toBe(1.5);
    expect(clampTtsSpeed(1)).toBe(1);
  });
});

describe("accessibility contract — reading prefs → CSS vars", () => {
  it("emits nothing when no reading pref is on (defaults fall through)", () => {
    expect(accessibilityProfileToCssVars(ACCESSIBILITY_DEFAULTS)).toEqual({});
  });

  it("maps dyslexiaFriendlyFont to the font-family sentinel + looser spacing", () => {
    const v = accessibilityProfileToCssVars({ largeText: false, dyslexiaFriendlyFont: true });
    expect(v[LEARNER_PREF_CSS_VARS.fontFamily]).toBe(LEARNER_PREF_SCALE.dyslexiaFontSentinel);
    expect(v[LEARNER_PREF_CSS_VARS.letterSpacing]).toBe(LEARNER_PREF_SCALE.looseLetterSpacing);
    expect(v[LEARNER_PREF_CSS_VARS.lineHeight]).toBe(String(LEARNER_PREF_SCALE.looseLineHeight));
    // Font is NOT scaled up just for the dyslexia face.
    expect(v[LEARNER_PREF_CSS_VARS.fontScale]).toBeUndefined();
  });

  it("maps largeText to the +25% font scale + looser spacing, no font swap", () => {
    const v = accessibilityProfileToCssVars({ largeText: true, dyslexiaFriendlyFont: false });
    expect(v[LEARNER_PREF_CSS_VARS.fontScale]).toBe(String(LEARNER_PREF_SCALE.largeTextFontScale));
    expect(v[LEARNER_PREF_CSS_VARS.letterSpacing]).toBe(LEARNER_PREF_SCALE.looseLetterSpacing);
    expect(v[LEARNER_PREF_CSS_VARS.lineHeight]).toBe(String(LEARNER_PREF_SCALE.looseLineHeight));
    expect(v[LEARNER_PREF_CSS_VARS.fontFamily]).toBeUndefined();
  });

  it("combines both prefs (the dyslexic large-text learner)", () => {
    const v = accessibilityProfileToCssVars({ largeText: true, dyslexiaFriendlyFont: true });
    expect(v[LEARNER_PREF_CSS_VARS.fontFamily]).toBe(LEARNER_PREF_SCALE.dyslexiaFontSentinel);
    expect(v[LEARNER_PREF_CSS_VARS.fontScale]).toBe(String(LEARNER_PREF_SCALE.largeTextFontScale));
    expect(v[LEARNER_PREF_CSS_VARS.letterSpacing]).toBe(LEARNER_PREF_SCALE.looseLetterSpacing);
    expect(v[LEARNER_PREF_CSS_VARS.lineHeight]).toBe(String(LEARNER_PREF_SCALE.looseLineHeight));
  });

  it("declares exactly the four canonical learner CSS-var names", () => {
    expect(Object.values(LEARNER_PREF_CSS_VARS)).toEqual([
      "--learner-font-family",
      "--learner-font-scale",
      "--learner-letter-spacing",
      "--learner-line-height",
    ]);
  });
});
