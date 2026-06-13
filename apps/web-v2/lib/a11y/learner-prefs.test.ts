import { describe, expect, it } from "vitest";
import { learnerPrefStyleVars } from "./learner-prefs";
import { ACCESSIBILITY_DEFAULTS, LEARNER_PREF_CSS_VARS } from "@aivo/accessibility-contract";

/**
 * C-09 — the web side of the reading-preference → CSS-var bridge. This proves
 * (substituting for the before/after screenshot DoD, since Playwright browsers
 * are not installed in CI) that a learner's persisted dyslexia / larger-text
 * preferences become the `--learner-*` CSS custom properties the baseline shell
 * stamps, so they apply INSIDE the question card.
 */
describe("learnerPrefStyleVars (web bridge)", () => {
  it("emits no vars for a default profile (the card renders unchanged)", () => {
    expect(learnerPrefStyleVars(ACCESSIBILITY_DEFAULTS)).toEqual({});
  });

  it("resolves the dyslexia font sentinel to the loaded Atkinson web stack", () => {
    const style = learnerPrefStyleVars({
      largeText: false,
      dyslexiaFriendlyFont: true,
    }) as Record<string, string>;
    // NOT the bare "dyslexia" sentinel — it must be the real web font var so
    // the browser never sees `font-family: dyslexia`.
    expect(style[LEARNER_PREF_CSS_VARS.fontFamily]).toBe("var(--aivo-fontFamily-dyslexia)");
    expect(style[LEARNER_PREF_CSS_VARS.letterSpacing]).toBe("0.03em");
    expect(style[LEARNER_PREF_CSS_VARS.lineHeight]).toBe("1.7");
  });

  it("emits the +25% font scale for a larger-text learner", () => {
    const style = learnerPrefStyleVars({
      largeText: true,
      dyslexiaFriendlyFont: false,
    }) as Record<string, string>;
    expect(style[LEARNER_PREF_CSS_VARS.fontScale]).toBe("1.25");
    // No font swap when only larger text is on.
    expect(style[LEARNER_PREF_CSS_VARS.fontFamily]).toBeUndefined();
  });

  it("combines both prefs for the dyslexic large-text learner (the headline case)", () => {
    const style = learnerPrefStyleVars({
      largeText: true,
      dyslexiaFriendlyFont: true,
    }) as Record<string, string>;
    expect(style[LEARNER_PREF_CSS_VARS.fontFamily]).toBe("var(--aivo-fontFamily-dyslexia)");
    expect(style[LEARNER_PREF_CSS_VARS.fontScale]).toBe("1.25");
    expect(style[LEARNER_PREF_CSS_VARS.letterSpacing]).toBe("0.03em");
    expect(style[LEARNER_PREF_CSS_VARS.lineHeight]).toBe("1.7");
  });
});
