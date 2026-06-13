// @vitest-environment jsdom

/**
 * Sprint C-03 — strengths-first, truthful build sequence.
 *
 * Substitutes for the runtime walk (no browser in this environment):
 *   1. STAGE_ORDER pins template → strengths → domains (strengths precede
 *      any levels — report §4.1 point 3).
 *   2. A timer-driven render walk (reduced-motion cadence) proves the
 *      strengths stage renders after the template intro and before the
 *      domains stage, the domains stage shows qualitative estimates only
 *      (no grade-equivalent / enrolled / gap meta), and the activation
 *      stage carries the truthful privacy chip instead of the deleted
 *      "Encrypted (AES-256)" / "Brain v1.0" / rollback claims.
 *   3. The strengths empty state renders the warm fallback copy.
 *
 * next-intl is mocked with a key-echoing `t`, so assertions on key names
 * double as assertions that no deleted key is rendered anywhere.
 */
import * as React from "react";
import { render, screen, cleanup, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stableT = (key: string, _vars?: Record<string, unknown>) => key;
vi.mock("next-intl", () => ({
  useTranslations: (_ns?: string) => stableT,
}));

// The WebGL sphere needs a real canvas; stub it (its own CSS fallback is
// covered by e2e/tests/brain-build-visual.spec.ts).
vi.mock("./pixi-brain-sphere", () => ({
  default: (props: { ariaLabel?: string }) => (
    <div data-testid="sphere-stub" aria-label={props.ariaLabel} />
  ),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

import BrainBuildingSequence, { STAGE_ORDER } from "./brain-building-sequence";

const STRENGTHS = {
  goodAt: ["Dinosaur facts", "Helping his sister"],
  loves: "Space documentaries",
  motivates: "",
  strongSubjects: ["Science"],
};

const MASTERY = [
  { domain: "math", displayLabel: "Math", reasoning: "", estimate: "growing" as const },
  { domain: "ela", displayLabel: "Reading", reasoning: "", estimate: "confident" as const },
];

function renderSequence(
  overrides: Partial<React.ComponentProps<typeof BrainBuildingSequence>> = {},
) {
  const onSequenceComplete = vi.fn();
  render(
    <BrainBuildingSequence
      learnerName="Sky"
      strengths={STRENGTHS}
      masteryDecisions={MASTERY}
      accommodationDecisions={[]}
      tutorDecisions={[]}
      primaryHue="#A78BFA"
      secondaryHues={["#06B6D4"]}
      onSequenceComplete={onSequenceComplete}
      {...overrides}
    />,
  );
  return { onSequenceComplete };
}

/** Advance fake timers inside act so stage-transition state lands. */
async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

/**
 * The sequence chains timers (each effect schedules the next dwell after the
 * previous state lands), so a single large advance only fires the first one.
 * Step virtual time in act-flushed slices until the predicate holds; fail
 * loudly if it never does (caps at ~80s virtual time).
 */
async function advanceUntil(predicate: () => boolean, step = 400, maxSteps = 200) {
  for (let i = 0; i < maxSteps; i++) {
    if (predicate()) return;
    await advance(step);
  }
  expect(predicate(), "condition not reached within the timer budget").toBe(true);
}

beforeEach(() => {
  vi.useFakeTimers();
  // Reduced-motion cadence: every dwell collapses to ≤700ms, which both
  // speeds the walk and proves the new stage participates in the existing
  // motion-free cadence rather than forking it.
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("STAGE_ORDER (C-03)", () => {
  it("opens with the template intro and puts strengths before domains", () => {
    expect(STAGE_ORDER[0]).toBe("template");
    expect(STAGE_ORDER.indexOf("strengths")).toBeGreaterThan(-1);
    expect(STAGE_ORDER.indexOf("strengths")).toBeLessThan(STAGE_ORDER.indexOf("domains"));
    expect(STAGE_ORDER[STAGE_ORDER.length - 1]).toBe("complete");
  });
});

describe("BrainBuildingSequence", () => {
  it("walks template → strengths → domains → accommodations → activation with truthful copy", async () => {
    renderSequence();

    // Template intro first — no grade number, no functioning-level enum.
    expect(screen.getByText("building_template_pill")).toBeTruthy();
    expect(screen.queryByText("building_strengths_title")).toBeNull();

    // template dwell (700 reduced) + 350 stage transition.
    await advance(1100);
    expect(screen.getByText("building_strengths_title")).toBeTruthy();
    // Strengths render before any domain levels exist on screen.
    expect(screen.queryByText("building_domains_title")).toBeNull();

    // Cards reveal one by one: the parent's own words, then the baseline
    // highlight (2 goodAt + loves + 1 strong subject = 4 cards) — all
    // mounted (and the last one revealed) while domains is still absent.
    await advanceUntil(() => screen.queryByText("Science") !== null);
    expect(screen.getByText("Dinosaur facts")).toBeTruthy();
    expect(screen.getByText("Helping his sister")).toBeTruthy();
    expect(screen.getByText("Space documentaries")).toBeTruthy();
    expect(screen.queryByText("building_domains_title")).toBeNull();

    // Strengths outro + transition → domains, revealing qualitative
    // estimates only.
    await advanceUntil(() => screen.queryByText("building_estimate_confident") !== null);
    expect(screen.getByText("building_domains_title")).toBeTruthy();
    expect(screen.getByText("building_estimate_growing")).toBeTruthy();
    // The fabricated grade ladder is gone: no level/enrolled/gap meta.
    expect(screen.queryByText("building_level")).toBeNull();
    expect(screen.queryByText("building_enrolled")).toBeNull();
    expect(screen.queryByText("building_gap")).toBeNull();
    expect(screen.queryByText(/Gap:/)).toBeNull();

    // Domains outro + transition → accommodations (empty ⇒ designed state).
    await advanceUntil(() => screen.queryByText("building_accommodations_none") !== null);

    // Accommodations dwell + transition → activation.
    await advanceUntil(() => screen.queryByText("building_activation_title") !== null);
    // The only trust chip is the honest one; the deleted claims never render.
    expect(screen.getByText("privacy_family")).toBeTruthy();
    expect(screen.queryByText("building_activation_encrypted")).toBeNull();
    expect(screen.queryByText("building_activation_version")).toBeNull();
    expect(screen.queryByText("building_activation_rollback")).toBeNull();
    expect(screen.queryByText(/AES/)).toBeNull();
  });

  it("hands control back after the complete stage under reduced motion", async () => {
    const { onSequenceComplete } = renderSequence();
    await advanceUntil(() => screen.queryByText("building_complete_title") !== null);
    // Reduced motion auto-advances past the celebratory CTA so the parent
    // lands on the recap + approval gate without dismissing an animation.
    await advanceUntil(() => onSequenceComplete.mock.calls.length > 0);
    expect(onSequenceComplete).toHaveBeenCalled();
  });

  it("renders the warm empty state when no strengths are recorded yet", async () => {
    renderSequence({
      strengths: { goodAt: [], loves: "", motivates: "", strongSubjects: [] },
    });
    await advance(1100);
    expect(screen.getByText("building_strengths_empty")).toBeTruthy();
    // Empty state still advances — the sequence never dead-ends.
    await advanceUntil(() => screen.queryByText("building_domains_title") !== null);
  });

  it("caps the strengths stage at five cards", async () => {
    renderSequence({
      strengths: {
        goodAt: ["One", "Two", "Three", "Four"],
        loves: "Five",
        motivates: "Six",
        strongSubjects: ["Seven"],
      },
    });
    await advance(1100);
    await advanceUntil(() => screen.queryByText("Six") !== null);
    // 3 goodAt (capped) + loves + motivates = 5; the rest never render.
    expect(screen.getByText("One")).toBeTruthy();
    expect(screen.getByText("Three")).toBeTruthy();
    expect(screen.queryByText("Four")).toBeNull();
    expect(screen.getByText("Five")).toBeTruthy();
    expect(screen.queryByText("Seven")).toBeNull();
  });
});
