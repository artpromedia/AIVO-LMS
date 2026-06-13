import type { CSSProperties } from "react";
import { LEARNER_PREF_CSS_VARS } from "@aivo/accessibility-contract";

/**
 * Baseline/learner-prefs
 *
 * The bridge that makes a learner's persisted reading preferences (dyslexia-
 * friendly font, larger text, looser spacing) take visible effect *inside* the
 * baseline question card — not just on the app chrome.
 *
 * The variable NAMES are owned by `@aivo/accessibility-contract`
 * ({@link LEARNER_PREF_CSS_VARS}); importing them here is how the baseline
 * components conform to that contract instead of inventing a parallel set of
 * ad-hoc class names that could drift from the persisted
 * `AccessibilityProfile`. The HOST (apps/web-v2 baseline shell) reads the
 * learner's profile, runs `accessibilityProfileToCssVars`, and stamps the
 * resulting `--learner-*` values onto the shell element; these style helpers
 * then read them with sensible fallbacks so the components render identically
 * when no preference is set.
 *
 * Scaling is multiplicative (`calc(base * var(--learner-font-scale, 1))`) so a
 * card keeps its own responsive base size and the learner's bump composes on
 * top — nothing is pinned to viewport pixels, so WCAG reflow/zoom still holds.
 */

const V = LEARNER_PREF_CSS_VARS;

/**
 * Prompt-level text style. `baseRem` is the card's intrinsic prompt size at
 * the current breakpoint (the component passes its own value), which the
 * learner's font-scale multiplies. Letter-spacing and line-height fall through
 * to the card's defaults when the learner has set no preference.
 */
export function learnerPromptStyle(baseRem: number): CSSProperties {
  return {
    fontFamily: `var(${V.fontFamily}, inherit)`,
    fontSize: `calc(${baseRem}rem * var(${V.fontScale}, 1))`,
    letterSpacing: `var(${V.letterSpacing}, normal)`,
    lineHeight: `var(${V.lineHeight}, 1.4)`,
  };
}

/**
 * Answer/choice-level text style. Same scale + font as the prompt but a
 * slightly tighter default line-height, since choice labels are shorter.
 */
export function learnerAnswerStyle(baseRem: number): CSSProperties {
  return {
    fontFamily: `var(${V.fontFamily}, inherit)`,
    fontSize: `calc(${baseRem}rem * var(${V.fontScale}, 1))`,
    letterSpacing: `var(${V.letterSpacing}, normal)`,
    lineHeight: `var(${V.lineHeight}, 1.5)`,
  };
}

export { LEARNER_PREF_CSS_VARS };
