// @vitest-environment jsdom

/**
 * Sprint C-14 — render-test substitution for the screenshot DoD (no browser in
 * this environment). Asserts:
 *   1. SCREEN ORDER — the stitched flow advances inputs(1) → strengths(2) →
 *      learns(3) → start(4) → onComplete, firing reveal_started + per-screen
 *      advance events in order.
 *   2. SOURCE CHIP + CONFIDENCE DOT BACKING — every chip/dot on screen 3 traces
 *      to a real source from the view-model; a facet with no source renders no
 *      card (no naked chip/dot).
 *   3. Empty/partial variants of screens 1 + 3 render their designed states.
 *
 * next-intl is mocked with a key-echoing `t`, so assertions on key names double
 * as assertions about which copy renders.
 */
import * as React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const stableT = (key: string) => key;
vi.mock("next-intl", () => ({ useTranslations: () => stableT }));
vi.mock("@/components/brain/pixi-brain-sphere", () => ({
  default: (props: { ariaLabel?: string }) => (
    <div data-testid="sphere-stub" aria-label={props.ariaLabel} />
  ),
}));

import { RevealFlow, type RevealFlowData } from "./reveal-flow";
import { HowSheLearns } from "./how-she-learns";
import { InputsAssembling } from "./inputs-assembling";
import type { OperatingInstruction } from "@/lib/learner/reveal-assembly";

const INSTRUCTIONS: OperatingInstruction[] = [
  { facet: "modality", valueKey: "visual", source: { kind: "parent", role: null }, confidence: "high" },
  {
    facet: "sensory",
    valueKey: "calm",
    source: { kind: "collaborator", role: "therapist" },
    confidence: "medium",
  },
];

const DATA: RevealFlowData = {
  contributions: {
    isEmpty: false,
    cards: [
      { key: "parent", kind: "parent", count: 11, role: null },
      { key: "baseline", kind: "baseline", count: 23, role: null },
    ],
  },
  strengths: { goodAt: ["Drawing"], loves: "Space", strongSubjects: [], observedStrength: null },
  instructions: INSTRUCTIONS,
  startingPoints: [{ subjectId: "reading", subjectName: "Reading", estimate: "new" }],
  shareContent: { firstName: "Maya", strengths: ["Drawing"], interests: ["Space"] },
};

function renderFlow(overrides: Partial<React.ComponentProps<typeof RevealFlow>> = {}) {
  const onScreenAdvance = vi.fn();
  const onComplete = vi.fn();
  render(
    <RevealFlow
      learnerName="Maya"
      primaryHue="#A78BFA"
      secondaryHues={["#06B6D4"]}
      pulseRate="steady"
      sphereAriaLabel="Maya's brain"
      data={DATA}
      onScreenAdvance={onScreenAdvance}
      onComplete={onComplete}
      {...overrides}
    />,
  );
  return { onScreenAdvance, onComplete };
}

afterEach(cleanup);

describe("RevealFlow — screen order", () => {
  it("steps inputs → strengths → learns → start → complete in order", () => {
    const { onScreenAdvance, onComplete } = renderFlow();

    // Screen 1 — inputs assembling.
    expect(screen.getByText("reveal_inputs_title")).toBeTruthy();
    expect(onScreenAdvance).toHaveBeenNthCalledWith(1, 1);

    fireEvent.click(screen.getByText("reveal_continue"));
    // Screen 2 — strengths recap (strengths-first preserved).
    expect(screen.getByText("building_strengths_title")).toBeTruthy();
    expect(onScreenAdvance).toHaveBeenNthCalledWith(2, 2);

    fireEvent.click(screen.getByText("reveal_continue"));
    // Screen 3 — how she learns.
    expect(screen.getByText("reveal_learns_title")).toBeTruthy();
    expect(onScreenAdvance).toHaveBeenNthCalledWith(3, 3);

    fireEvent.click(screen.getByText("reveal_continue"));
    // Screen 4 — where we'll start.
    expect(screen.getByText("reveal_start_title")).toBeTruthy();
    expect(onScreenAdvance).toHaveBeenNthCalledWith(4, 4);

    // Past the last beat → onComplete (reveal the ceremony).
    fireEvent.click(screen.getByText("reveal_continue"));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe("HowSheLearns — source chips + confidence dots", () => {
  it("renders a chip + confidence label for each backed instruction", () => {
    render(<HowSheLearns learnerName="Maya" instructions={INSTRUCTIONS} />);
    // Parent-sourced modality card → "You told us" chip + "fairly sure" dot.
    expect(screen.getByText("reveal_learns_source_parent")).toBeTruthy();
    expect(screen.getByText("reveal_learns_confidence_high")).toBeTruthy();
    // Therapist-sourced sensory card → "their therapist observed" + medium.
    expect(screen.getByText("reveal_learns_source_collaborator_therapist")).toBeTruthy();
    expect(screen.getByText("reveal_learns_confidence_medium")).toBeTruthy();
    // The instruction copy itself renders.
    expect(screen.getByText("reveal_learns_modality_visual")).toBeTruthy();
    expect(screen.getByText("reveal_learns_sensory_calm")).toBeTruthy();
  });

  it("renders the designed empty state when no instruction has backing data", () => {
    render(<HowSheLearns learnerName="Maya" instructions={[]} />);
    expect(screen.getByText("reveal_learns_empty_title")).toBeTruthy();
    // No chip or dot renders without backing data.
    expect(screen.queryByText("reveal_learns_source_parent")).toBeNull();
    expect(screen.queryByText("reveal_learns_confidence_high")).toBeNull();
  });
});

describe("InputsAssembling — zero-contributor + partial variants", () => {
  it("renders the honest empty state with zero contributors", () => {
    render(
      <InputsAssembling
        learnerName="Maya"
        contributions={{ isEmpty: true, cards: [] }}
        reducedMotion
      />,
    );
    expect(screen.getByText("reveal_inputs_empty_title")).toBeTruthy();
  });

  it("renders a single source card in the partial variant", () => {
    render(
      <InputsAssembling
        learnerName="Maya"
        contributions={{ isEmpty: false, cards: [{ key: "parent", kind: "parent", count: 4, role: null }] }}
        reducedMotion
      />,
    );
    expect(screen.getByText("reveal_inputs_parent_title")).toBeTruthy();
    expect(screen.queryByText("reveal_inputs_baseline_title")).toBeNull();
  });
});
