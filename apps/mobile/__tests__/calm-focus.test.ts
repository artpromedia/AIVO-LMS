/**
 * Focus monitor (mobile port) — parity with the web focus contract.
 *
 * Mirrors apps/web-v2/lib/homework/__tests__/focus.test.ts so the mobile
 * port can never silently drift from the homework-svc focus contract. Pins
 * every threshold boundary and asserts the recommended action composes with
 * recommendCalmActivity into a valid CalmActivityId for every FocusState.
 */
import { describe, expect, it } from "vitest";
import {
  observeFocus,
  type FocusObservation,
  type FocusState,
} from "../lib/calm-focus";
import { recommendCalmActivity, isCalmActivityId } from "../lib/calm";

describe("focus monitor — service parity", () => {
  it("reports focused when signals are nominal", () => {
    expect(observeFocus({}).state).toBe("focused");
  });

  it("flags frustration on high eraser count", () => {
    const obs = observeFocus({ eraserCount: 6 });
    expect(obs.state).toBe("frustrated");
    expect(obs.recommendedAction).toBe("switch_surface");
  });

  it("flags frustration on repeated wrong attempts", () => {
    const obs = observeFocus({ consecutiveWrongAttempts: 3 });
    expect(obs.state).toBe("frustrated");
    expect(obs.recommendedAction).toBe("simplify_step");
  });

  it("recommends a break on long inactivity", () => {
    const obs = observeFocus({ inactivityMs: 130_000 });
    expect(obs.state).toBe("needs_break");
    expect(obs.recommendedAction).toBe("offer_break");
  });

  it("recommends a micro hint when latency is high", () => {
    const obs = observeFocus({ latencyMs: 60_000 });
    expect(obs.state).toBe("needs_prompt");
    expect(obs.recommendedAction).toBe("micro_hint");
  });

  it("flags abandoned surface", () => {
    expect(observeFocus({ abandonedSurface: true }).state).toBe("needs_break");
  });
});

describe("focus monitor — threshold boundaries", () => {
  it("does not flag just below the wrong-attempt threshold", () => {
    expect(observeFocus({ consecutiveWrongAttempts: 2 }).state).toBe("focused");
    expect(observeFocus({ consecutiveWrongAttempts: 3 }).state).toBe("frustrated");
  });

  it("does not flag just below the eraser threshold", () => {
    expect(observeFocus({ eraserCount: 4 }).state).toBe("focused");
    expect(observeFocus({ eraserCount: 5 }).state).toBe("frustrated");
  });

  it("treats 3+ hint requests as needs_prompt", () => {
    expect(observeFocus({ hintRequests: 2 }).state).toBe("focused");
    expect(observeFocus({ hintRequests: 3 })).toMatchObject({
      state: "needs_prompt",
      recommendedAction: "micro_hint",
    });
  });

  it("treats 4+ tool switches as needs_prompt", () => {
    expect(observeFocus({ toolSwitchCount: 3 }).state).toBe("focused");
    expect(observeFocus({ toolSwitchCount: 4 })).toMatchObject({
      state: "needs_prompt",
      recommendedAction: "micro_hint",
    });
  });

  it("uses the prompt vs break inactivity boundaries", () => {
    expect(observeFocus({ inactivityMs: 29_999 }).state).toBe("focused");
    expect(observeFocus({ inactivityMs: 30_000 }).state).toBe("needs_prompt");
    expect(observeFocus({ inactivityMs: 119_999 }).state).toBe("needs_prompt");
    expect(observeFocus({ inactivityMs: 120_000 }).state).toBe("needs_break");
  });

  it("uses the high-latency boundary", () => {
    expect(observeFocus({ latencyMs: 44_999 }).state).toBe("focused");
    expect(observeFocus({ latencyMs: 45_000 }).state).toBe("needs_prompt");
  });

  it("prioritises abandonment over every other signal", () => {
    const obs = observeFocus({
      abandonedSurface: true,
      consecutiveWrongAttempts: 9,
      eraserCount: 9,
      inactivityMs: 999_999,
    });
    expect(obs).toMatchObject({ state: "needs_break", recommendedAction: "offer_break" });
  });
});

describe("observeFocus ∘ recommendCalmActivity", () => {
  const byState: Record<FocusState, FocusObservation> = {
    focused: observeFocus({}),
    needs_prompt: observeFocus({ inactivityMs: 30_000 }),
    frustrated: observeFocus({ consecutiveWrongAttempts: 3 }),
    needs_break: observeFocus({ inactivityMs: 120_000 }),
  };

  it("covers all four states", () => {
    for (const state of Object.keys(byState) as FocusState[]) {
      expect(byState[state].state).toBe(state);
    }
  });

  it("maps every state's recommendedAction to a valid CalmActivityId", () => {
    for (const state of Object.keys(byState) as FocusState[]) {
      const activityId = recommendCalmActivity(byState[state].recommendedAction);
      expect(isCalmActivityId(activityId)).toBe(true);
    }
  });
});
