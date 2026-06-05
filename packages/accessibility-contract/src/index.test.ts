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
