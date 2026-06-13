/**
 * Sprint C-15 — unit tests for the baseline scan configuration helpers.
 *
 * Covers the pure decisions the runner relies on:
 *   - WHEN scanning activates (only on an explicit switch input method —
 *     never auto-enabled by inference);
 *   - the conservative baseline dwell floor + honoring an explicit dwell;
 *   - single-switch auto-scan vs. two-switch step-scan mapping;
 *   - the readiness-screen "button-friendly mode?" suggestion gate.
 */
import { describe, it, expect } from "vitest";
import {
  BASELINE_DEFAULT_SCAN_DELAY_MS,
  isScanInputMethod,
  resolveBaselineScanConfig,
  shouldSuggestButtonFriendlyMode,
  type BaselineScanPrefs,
} from "./baseline-scan";
import {
  DEFAULT_AAC_SCAN_DELAY_MS,
  MAX_AAC_SCAN_DELAY_MS,
  MIN_AAC_SCAN_DELAY_MS,
} from "@aivo/accessibility-contract";

const base: BaselineScanPrefs = {
  aacEnabled: false,
  aacInputMethod: "touch",
  aacScanDelayMs: DEFAULT_AAC_SCAN_DELAY_MS,
};

describe("isScanInputMethod", () => {
  it("is true only for the two switch methods", () => {
    expect(isScanInputMethod("switch_1")).toBe(true);
    expect(isScanInputMethod("switch_2")).toBe(true);
    expect(isScanInputMethod("touch")).toBe(false);
    expect(isScanInputMethod("eye_gaze")).toBe(false);
    expect(isScanInputMethod("head_pointer")).toBe(false);
  });
});

describe("resolveBaselineScanConfig — activation gating", () => {
  it("is inactive when AAC is disabled (no scanning by inference)", () => {
    const cfg = resolveBaselineScanConfig({
      ...base,
      aacEnabled: false,
      aacInputMethod: "switch_1",
    });
    expect(cfg.active).toBe(false);
  });

  it("is inactive when AAC is on but the method is not a switch method", () => {
    for (const method of ["touch", "eye_gaze", "head_pointer"] as const) {
      const cfg = resolveBaselineScanConfig({ ...base, aacEnabled: true, aacInputMethod: method });
      expect(cfg.active, `method=${method}`).toBe(false);
    }
  });

  it("is active when AAC is on and the method is a switch method", () => {
    expect(
      resolveBaselineScanConfig({ ...base, aacEnabled: true, aacInputMethod: "switch_1" }).active,
    ).toBe(true);
    expect(
      resolveBaselineScanConfig({ ...base, aacEnabled: true, aacInputMethod: "switch_2" }).active,
    ).toBe(true);
  });
});

describe("resolveBaselineScanConfig — auto-scan vs step-scan", () => {
  it("single switch auto-scans (timer on)", () => {
    const cfg = resolveBaselineScanConfig({
      ...base,
      aacEnabled: true,
      aacInputMethod: "switch_1",
    });
    expect(cfg.autoScan).toBe(true);
    expect(cfg.stepScan).toBe(false);
  });

  it("two switches step-scan (timer off — learner advances manually)", () => {
    const cfg = resolveBaselineScanConfig({
      ...base,
      aacEnabled: true,
      aacInputMethod: "switch_2",
    });
    expect(cfg.autoScan).toBe(false);
    expect(cfg.stepScan).toBe(true);
  });
});

describe("resolveBaselineScanConfig — dwell", () => {
  it("raises the contract default to the conservative baseline floor", () => {
    const cfg = resolveBaselineScanConfig({
      ...base,
      aacEnabled: true,
      aacInputMethod: "switch_1",
      aacScanDelayMs: DEFAULT_AAC_SCAN_DELAY_MS,
    });
    expect(cfg.scanDelayMs).toBe(BASELINE_DEFAULT_SCAN_DELAY_MS);
    // The baseline floor must sit in the spec's calm 1.5–2s band.
    expect(cfg.scanDelayMs).toBeGreaterThanOrEqual(1500);
    expect(cfg.scanDelayMs).toBeLessThanOrEqual(2000);
  });

  it("honors an explicitly-chosen dwell (does not override a learner's value)", () => {
    const cfg = resolveBaselineScanConfig({
      ...base,
      aacEnabled: true,
      aacInputMethod: "switch_1",
      aacScanDelayMs: 3000,
    });
    expect(cfg.scanDelayMs).toBe(3000);
  });

  it("clamps an out-of-range dwell to the contract bounds", () => {
    const tooFast = resolveBaselineScanConfig({
      ...base,
      aacEnabled: true,
      aacInputMethod: "switch_1",
      aacScanDelayMs: 50,
    });
    expect(tooFast.scanDelayMs).toBe(MIN_AAC_SCAN_DELAY_MS);
    const tooSlow = resolveBaselineScanConfig({
      ...base,
      aacEnabled: true,
      aacInputMethod: "switch_1",
      aacScanDelayMs: 99999,
    });
    expect(tooSlow.scanDelayMs).toBe(MAX_AAC_SCAN_DELAY_MS);
  });
});

describe("shouldSuggestButtonFriendlyMode", () => {
  it("suggests when the parent assessment recorded a switch response method", () => {
    expect(shouldSuggestButtonFriendlyMode({ responseMethod: "switch" }, false)).toBe(true);
  });

  it("suggests when the parent assessment recorded eye-gaze", () => {
    expect(shouldSuggestButtonFriendlyMode({ responseMethod: "eye_gaze" }, false)).toBe(true);
  });

  it("suggests for switch_access / eye_gaze device interaction and aac comms", () => {
    expect(shouldSuggestButtonFriendlyMode({ deviceInteraction: "switch_access" }, false)).toBe(
      true,
    );
    expect(shouldSuggestButtonFriendlyMode({ deviceInteraction: "eye_gaze" }, false)).toBe(true);
    expect(shouldSuggestButtonFriendlyMode({ communicationMode: "aac" }, false)).toBe(true);
  });

  it("does NOT suggest for touch / verbal learners", () => {
    expect(
      shouldSuggestButtonFriendlyMode(
        { responseMethod: "touch", communicationMode: "verbal" },
        false,
      ),
    ).toBe(false);
    expect(shouldSuggestButtonFriendlyMode({}, false)).toBe(false);
  });

  it("does NOT suggest once AAC is already enabled (nothing to nudge)", () => {
    expect(shouldSuggestButtonFriendlyMode({ responseMethod: "switch" }, true)).toBe(false);
  });
});
