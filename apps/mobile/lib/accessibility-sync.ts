/**
 * Maps the mobile ergonomic accessibility prefs (A11yPreferences) to and from
 * the canonical @aivo/accessibility-contract AccessibilityProfile that the
 * backend stores. This is what lets a learner's accessibility choices follow
 * them across devices and stay consistent with the web app, which persists the
 * same canonical shape.
 *
 * Only the fields the two models share are synced; mobile-only granularity
 * (the small/medium/large text scale, the break interval) stays on-device.
 */
import {
  ACCESSIBILITY_DEFAULTS,
  type AccessibilityProfile,
} from "@aivo/accessibility-contract";
import type { A11yPreferences } from "./preferences-logic";

/** Build the canonical profile to upload from the current mobile prefs. */
export function a11yToProfile(
  a11y: A11yPreferences,
  base?: Partial<AccessibilityProfile>,
): AccessibilityProfile {
  return {
    ...ACCESSIBILITY_DEFAULTS,
    ...base,
    reducedMotion: a11y.reduceMotion,
    largeText: a11y.textScale === "large",
    dyslexiaFriendlyFont: a11y.dyslexiaFriendlyFont,
    captionsAlwaysOn: a11y.captionsDefault,
    readAloud: a11y.readAloudDefault,
    breakReminders: a11y.breakReminders,
  };
}

/**
 * Build the mobile-prefs patch to apply from a downloaded canonical profile.
 * Returns only the shared fields, and only nudges the text-scale across the
 * large boundary so a local "small" choice isn't clobbered by a profile that
 * merely has largeText=false.
 */
export function profileToA11yPatch(
  profile: Partial<AccessibilityProfile>,
  current: A11yPreferences,
): Partial<A11yPreferences> {
  const patch: Partial<A11yPreferences> = {};
  if (typeof profile.reducedMotion === "boolean") patch.reduceMotion = profile.reducedMotion;
  if (typeof profile.dyslexiaFriendlyFont === "boolean") {
    patch.dyslexiaFriendlyFont = profile.dyslexiaFriendlyFont;
  }
  if (typeof profile.captionsAlwaysOn === "boolean") patch.captionsDefault = profile.captionsAlwaysOn;
  if (typeof profile.readAloud === "boolean") patch.readAloudDefault = profile.readAloud;
  if (typeof profile.breakReminders === "boolean") patch.breakReminders = profile.breakReminders;
  if (typeof profile.largeText === "boolean") {
    if (profile.largeText) patch.textScale = "large";
    else if (current.textScale === "large") patch.textScale = "medium";
  }
  return patch;
}
