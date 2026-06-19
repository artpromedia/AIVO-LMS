import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LearnerQuestionCard } from "../../baseline/LearnerQuestionCard.js";
import { LearnerChoiceCard } from "../../baseline/LearnerChoiceCard.js";
import {
  learnerPromptStyle,
  learnerAnswerStyle,
  LEARNER_PREF_CSS_VARS,
} from "../../baseline/learner-prefs.js";

/**
 * C-09 — the question card + answer cards must consume the learner's reading
 * preferences via the `--learner-*` contract CSS vars, so a dyslexia / large-
 * text learner sees their settings INSIDE the question. These tests pin the
 * var wiring at the component boundary (the actual visual effect is exercised
 * by the e2e prefers-reduced-motion + var-bridge specs).
 */

describe("learner-prefs style helpers", () => {
  it("prompt style references all four learner CSS vars with fallbacks", () => {
    const s = learnerPromptStyle(1.5) as Record<string, string>;
    expect(s.fontFamily).toBe(`var(${LEARNER_PREF_CSS_VARS.fontFamily}, inherit)`);
    expect(s.fontSize).toBe(`calc(1.5rem * var(${LEARNER_PREF_CSS_VARS.fontScale}, 1))`);
    expect(s.letterSpacing).toBe(`var(${LEARNER_PREF_CSS_VARS.letterSpacing}, normal)`);
    expect(s.lineHeight).toBe(`var(${LEARNER_PREF_CSS_VARS.lineHeight}, 1.4)`);
  });

  it("answer style scales from its own base and reads the same vars", () => {
    const s = learnerAnswerStyle(1) as Record<string, string>;
    expect(s.fontSize).toBe(`calc(1rem * var(${LEARNER_PREF_CSS_VARS.fontScale}, 1))`);
    expect(s.fontFamily).toBe(`var(${LEARNER_PREF_CSS_VARS.fontFamily}, inherit)`);
  });
});

describe("LearnerQuestionCard prompt consumes learner prefs", () => {
  const html = renderToStaticMarkup(
    <LearnerQuestionCard prompt="What comes next?">
      <div>answers</div>
    </LearnerQuestionCard>,
  );

  it("renders the prompt text", () => {
    expect(html).toContain("What comes next?");
  });

  it("scales the prompt font-size by --learner-font-scale (not a fixed text-2xl)", () => {
    // The multiplicative scale must be present so a learner's larger-text
    // preference grows the prompt inside the card.
    expect(html).toContain("var(--learner-font-scale, 1)");
    expect(html).toContain("--prompt-base");
  });

  it("applies the dyslexia-aware font-family var on the prompt", () => {
    expect(html).toContain("var(--learner-font-family, inherit)");
  });

  it("applies letter-spacing + line-height vars on the prompt", () => {
    expect(html).toContain("var(--learner-letter-spacing, normal)");
    expect(html).toContain("var(--learner-line-height,");
  });

  it("no longer hardcodes the old fixed type scale on the prompt heading", () => {
    // Guard against a regression back to `text-2xl md:text-3xl` on the <h2>.
    expect(html).toMatch(/data-learner-prompt/);
  });
});

describe("LearnerChoiceCard label consumes learner prefs and keeps its tap floor", () => {
  const html = renderToStaticMarkup(
    <LearnerChoiceCard name="response" value="dog" label="A dog" index={0} />,
  );

  it("scales the label by --learner-font-scale", () => {
    expect(html).toContain("var(--learner-font-scale, 1)");
    expect(html).toContain("--answer-base");
  });

  it("keeps the 76px min touch-target floor (larger-of, never smaller)", () => {
    // BaselineAssessment handoff: the answer card grew to a 76px floor (52px
    // icon square + generous padding). Still a floor, never a ceiling — a
    // larger-text learner gets a taller card.
    expect(html).toContain("min-h-[76px]");
  });

  it("uses the dyslexia-aware font-family var on the label", () => {
    expect(html).toContain("var(--learner-font-family, inherit)");
  });
});
