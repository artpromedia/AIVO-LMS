/**
 * Learner reading-preference → CSS-var bridge (web).
 *
 * Extends the existing a11y bridge (`lib/a11y/*` cookie/`data-*` prefs and the
 * `lib/sensory-mode` cookie → CSS-var mechanism) to the learner's *persisted*
 * `AccessibilityProfile` (the contract type stored per-learner via
 * `getAccessibilityPrefs`). Those app-chrome prefs are browser-local toggles;
 * THIS reads the durable, cross-device learner profile so a dyslexic /
 * large-text learner sees their settings inside the baseline question itself,
 * mid-assessment — the moment that matters most.
 *
 * The canonical field-name → CSS-var mapping lives in
 * `@aivo/accessibility-contract` (`accessibilityProfileToCssVars` +
 * `LEARNER_PREF_CSS_VARS`); this module only resolves the framework-free
 * `"dyslexia"` font sentinel into the web font stack the root layout actually
 * loaded (Atkinson Hyperlegible, `--aivo-fontFamily-dyslexia`, self-hosted in
 * `app/layout.tsx`). Keeping the sentinel in the contract means the contract
 * never hard-codes a web font name it can't guarantee is present on a client.
 */
import type { CSSProperties } from "react";
import {
  accessibilityProfileToCssVars,
  LEARNER_PREF_CSS_VARS,
  LEARNER_PREF_SCALE,
  type AccessibilityProfile,
} from "@aivo/accessibility-contract";

/** The brand var the root layout binds to the loaded Atkinson Hyperlegible face. */
const WEB_DYSLEXIA_FONT_STACK = "var(--aivo-fontFamily-dyslexia)";

/**
 * Build the inline `style` object of `--learner-*` CSS custom properties for a
 * learner's reading preferences, ready to stamp on the baseline shell. Returns
 * an empty object when no reading preference is set, so the shell renders
 * exactly as before for learners with default preferences.
 *
 * The `--learner-font-family` sentinel (`"dyslexia"`) is resolved here to the
 * web dyslexia font stack; every other var passes through unchanged.
 */
export function learnerPrefStyleVars(
  profile: Pick<AccessibilityProfile, "largeText" | "dyslexiaFriendlyFont">,
): CSSProperties {
  const vars = accessibilityProfileToCssVars(profile);
  const style: Record<string, string> = { ...vars };
  if (style[LEARNER_PREF_CSS_VARS.fontFamily] === LEARNER_PREF_SCALE.dyslexiaFontSentinel) {
    style[LEARNER_PREF_CSS_VARS.fontFamily] = WEB_DYSLEXIA_FONT_STACK;
  }
  return style as CSSProperties;
}
