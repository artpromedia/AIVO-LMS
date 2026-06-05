import { describe, expect, it } from "vitest";
import { ACCESSIBILITY_DEFAULTS } from "./index";
import {
  AccessibilityPatchSchema,
  AccessibilityProfileSchema,
  applyAccessibilityPatch,
} from "./schema";

describe("accessibility contract — schema", () => {
  it("validates the defaults as a complete profile", () => {
    expect(AccessibilityProfileSchema.safeParse(ACCESSIBILITY_DEFAULTS).success).toBe(true);
  });

  it("accepts a partial patch", () => {
    const r = AccessibilityPatchSchema.safeParse({ dyslexiaFriendlyFont: true });
    expect(r.success).toBe(true);
  });

  it("rejects unknown keys (strict)", () => {
    expect(AccessibilityPatchSchema.safeParse({ nope: true }).success).toBe(false);
  });

  it("rejects an out-of-range scan delay", () => {
    expect(AccessibilityPatchSchema.safeParse({ aacScanDelayMs: 50 }).success).toBe(false);
    expect(AccessibilityPatchSchema.safeParse({ aacScanDelayMs: 1200 }).success).toBe(true);
  });

  it("rejects an invalid AAC input method", () => {
    expect(AccessibilityPatchSchema.safeParse({ aacInputMethod: "telepathy" }).success).toBe(false);
    expect(AccessibilityPatchSchema.safeParse({ aacInputMethod: "eye_gaze" }).success).toBe(true);
  });

  it("applies a patch over defaults, preserving untouched fields", () => {
    const next = applyAccessibilityPatch(undefined, { highContrast: true });
    expect(next.highContrast).toBe(true);
    expect(next.reducedMotion).toBe(false);
    expect(next.aacInputMethod).toBe("touch");
  });
});
