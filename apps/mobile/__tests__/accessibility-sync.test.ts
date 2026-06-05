import { describe, it, expect } from "vitest";
import { a11yToProfile, profileToA11yPatch } from "../lib/accessibility-sync";
import { DEFAULT_A11Y, type A11yPreferences } from "../lib/preferences-logic";
import { ACCESSIBILITY_DEFAULTS } from "@aivo/accessibility-contract";

const a11y = (over: Partial<A11yPreferences> = {}): A11yPreferences => ({ ...DEFAULT_A11Y, ...over });

describe("a11yToProfile", () => {
  it("maps the shared fields onto a complete canonical profile", () => {
    const p = a11yToProfile(
      a11y({
        reduceMotion: true,
        textScale: "large",
        dyslexiaFriendlyFont: true,
        captionsDefault: true,
        readAloudDefault: true,
        breakReminders: true,
      }),
    );
    expect(p.reducedMotion).toBe(true);
    expect(p.largeText).toBe(true);
    expect(p.dyslexiaFriendlyFont).toBe(true);
    expect(p.captionsAlwaysOn).toBe(true);
    expect(p.readAloud).toBe(true);
    expect(p.breakReminders).toBe(true);
    // Unmapped fields fall back to the contract defaults.
    expect(p.aacInputMethod).toBe(ACCESSIBILITY_DEFAULTS.aacInputMethod);
  });

  it("largeText is false for non-large text scales", () => {
    expect(a11yToProfile(a11y({ textScale: "small" })).largeText).toBe(false);
    expect(a11yToProfile(a11y({ textScale: "medium" })).largeText).toBe(false);
  });

  it("preserves base fields not owned by mobile", () => {
    const p = a11yToProfile(a11y(), { aacEnabled: true, aacScanDelayMs: 2000 });
    expect(p.aacEnabled).toBe(true);
    expect(p.aacScanDelayMs).toBe(2000);
  });
});

describe("profileToA11yPatch", () => {
  it("maps shared fields back to a mobile patch", () => {
    const patch = profileToA11yPatch(
      { reducedMotion: true, dyslexiaFriendlyFont: true, captionsAlwaysOn: true, readAloud: true, breakReminders: true },
      a11y(),
    );
    expect(patch).toEqual({
      reduceMotion: true,
      dyslexiaFriendlyFont: true,
      captionsDefault: true,
      readAloudDefault: true,
      breakReminders: true,
    });
  });

  it("largeText=true nudges text scale to large", () => {
    expect(profileToA11yPatch({ largeText: true }, a11y({ textScale: "medium" })).textScale).toBe("large");
  });

  it("largeText=false only steps down from large (never clobbers small)", () => {
    expect(profileToA11yPatch({ largeText: false }, a11y({ textScale: "large" })).textScale).toBe("medium");
    expect(profileToA11yPatch({ largeText: false }, a11y({ textScale: "small" })).textScale).toBeUndefined();
  });

  it("ignores absent fields (partial profile)", () => {
    expect(profileToA11yPatch({}, a11y())).toEqual({});
  });
});
