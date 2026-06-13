// @vitest-environment jsdom

/**
 * Sprint C-15 — jsdom interaction test for baseline switch scanning.
 *
 * This is the LOCAL substitute for the part of the switch-only Playwright e2e
 * that drives the runner with switch input (Playwright is not installed in
 * this environment — the e2e itself is written in
 * `e2e/baseline-switch-scan.playwright.ts` to ride CI). Here we mount the REAL
 * `BaselineScanProvider` (which mounts the real `@aivo/aac-bridge`
 * `AACTargetProvider` + `AACScanRoot` + `SwitchScanController`) around a DOM
 * that mirrors the runner's operable elements, and drive it with simulated
 * SWITCH input only — keyboard `keydown` events, never a pointer:
 *
 *   - Space  = select   (single-switch activate, and step-scan "pick")
 *   - ArrowRight = advance (step-scan "move")
 *
 * It asserts the binding behaviours: DOM-order traversal, Skip reachable in
 * the cycle, activation fires the highlighted control, the highlight ring
 * attribute tracks the controller, and two-switch step scanning advances only
 * on the advance key. No `click()` / `fireEvent.click` is ever used on a
 * control — proving the surface is operable with zero pointer events.
 */
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BaselineScanProvider, SCAN_CURRENT_ATTR } from "./baseline-scan-provider";
import type { BaselineScanConfig } from "@/lib/a11y/baseline-scan";

afterEach(cleanup);

/** Dispatch a real keyboard event on `document` — the only input the test
 *  ever sends. `AACScanRoot` listens on `window` for keydown. */
function pressKey(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

/** A composition mirroring the runner's question screen operable elements, in
 *  reading/DOM order: read-aloud, two choices, hint, Skip, Next. Each carries
 *  the `data-scan-target` markers the runner stamps. The submit buttons record
 *  activations through a spy instead of submitting a form. */
function QuestionHarness({
  config,
  onActivate,
  speakOnFocus = false,
}: {
  config: BaselineScanConfig;
  onActivate: (id: string) => void;
  speakOnFocus?: boolean;
}) {
  return (
    <BaselineScanProvider
      config={config}
      speakOnFocus={speakOnFocus}
      scanHelpText="help"
      announceTemplate={(label) => `Now on: ${label}`}
    >
      <div>
        <a
          href="?read=q1"
          data-scan-target="q1-readaloud"
          data-scan-action="read-aloud"
          data-scan-label="Hear the question"
          data-scan-read="The prompt. Read aloud body."
          onClick={(e) => {
            e.preventDefault();
            onActivate("q1-readaloud-click");
          }}
        >
          Read aloud
        </a>
        {/* Choice cards: clicking the label checks the radio. */}
        <label data-scan-target="q1-choice-0" data-scan-label="Apple">
          <input
            type="radio"
            name="response"
            value="Apple"
            onChange={() => onActivate("choice-0")}
          />
          Apple
        </label>
        <label data-scan-target="q1-choice-1" data-scan-label="Banana">
          <input
            type="radio"
            name="response"
            value="Banana"
            onChange={() => onActivate("choice-1")}
          />
          Banana
        </label>
        <button
          type="button"
          data-scan-target="q1-hint"
          data-scan-label="Get a hint"
          onClick={() => onActivate("hint")}
        >
          Need a hint?
        </button>
        <button
          type="button"
          data-scan-target="q1-skip"
          data-scan-label="Skip this one"
          onClick={() => onActivate("skip")}
        >
          Skip
        </button>
        <button
          type="button"
          data-scan-target="q1-next"
          data-scan-label="Go to the next one"
          onClick={() => onActivate("next")}
        >
          Next
        </button>
      </div>
    </BaselineScanProvider>
  );
}

const AUTO_SCAN: BaselineScanConfig = {
  active: true,
  inputMethod: "switch_1",
  scanDelayMs: 1000,
  autoScan: true,
  stepScan: false,
};

const STEP_SCAN: BaselineScanConfig = {
  active: true,
  inputMethod: "switch_2",
  scanDelayMs: 1000,
  autoScan: false,
  stepScan: true,
};

function currentTargetId(): string | null {
  const el = document.querySelector<HTMLElement>(`[${SCAN_CURRENT_ATTR}="true"]`);
  return el?.getAttribute("data-scan-target") ?? null;
}

describe("baseline switch scanning — inactive config", () => {
  it("renders children untouched and registers no scan ring when scanning is off", () => {
    const onActivate = vi.fn();
    render(<QuestionHarness config={{ ...AUTO_SCAN, active: false }} onActivate={onActivate} />);
    // No highlight ring, and the controls still render (standard runner).
    expect(currentTargetId()).toBeNull();
    expect(screen.getByText("Skip")).toBeTruthy();
    // A keypress does nothing (no scanner mounted).
    pressKey(" ");
    expect(onActivate).not.toHaveBeenCalled();
  });
});

describe("baseline switch scanning — single switch (auto-scan)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("highlights the first operable element in DOM order on mount", () => {
    render(<QuestionHarness config={AUTO_SCAN} onActivate={vi.fn()} />);
    expect(currentTargetId()).toBe("q1-readaloud");
  });

  it("auto-advances through targets in DOM/reading order on the timer", () => {
    render(<QuestionHarness config={AUTO_SCAN} onActivate={vi.fn()} />);
    const order: string[] = [];
    order.push(currentTargetId()!);
    for (let i = 0; i < 5; i++) {
      act(() => vi.advanceTimersByTime(1000));
      order.push(currentTargetId()!);
    }
    expect(order).toEqual([
      "q1-readaloud",
      "q1-choice-0",
      "q1-choice-1",
      "q1-hint",
      "q1-skip",
      "q1-next",
    ]);
  });

  it("Skip is reachable in the cycle and selecting it activates Skip — no pointer", () => {
    const onActivate = vi.fn();
    render(<QuestionHarness config={AUTO_SCAN} onActivate={onActivate} />);
    // Advance to Skip (index 4): readaloud→choice0→choice1→hint→skip.
    act(() => vi.advanceTimersByTime(1000 * 4));
    expect(currentTargetId()).toBe("q1-skip");
    pressKey(" "); // select switch
    expect(onActivate).toHaveBeenCalledWith("skip");
  });

  it("selecting a choice checks its radio (activation via switch, not click)", () => {
    const onActivate = vi.fn();
    render(<QuestionHarness config={AUTO_SCAN} onActivate={onActivate} />);
    act(() => vi.advanceTimersByTime(1000)); // → choice-0
    expect(currentTargetId()).toBe("q1-choice-0");
    pressKey(" ");
    expect(onActivate).toHaveBeenCalledWith("choice-0");
    const radio = screen.getByDisplayValue("Apple") as HTMLInputElement;
    expect(radio.checked).toBe(true);
  });

  it("Enter also selects (Space/Enter fallback)", () => {
    const onActivate = vi.fn();
    render(<QuestionHarness config={AUTO_SCAN} onActivate={onActivate} />);
    act(() => vi.advanceTimersByTime(1000 * 5)); // → next
    expect(currentTargetId()).toBe("q1-next");
    pressKey("Enter");
    expect(onActivate).toHaveBeenCalledWith("next");
  });

  it("read-aloud target speaks instead of navigating", () => {
    const speak = vi.fn();
    // Stub the Web Speech API the provider uses.
    vi.stubGlobal("speechSynthesis", {
      cancel: vi.fn(),
      speak,
    });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        constructor(t: string) {
          this.text = t;
        }
      },
    );
    const onActivate = vi.fn();
    render(<QuestionHarness config={AUTO_SCAN} onActivate={onActivate} />);
    expect(currentTargetId()).toBe("q1-readaloud");
    pressKey(" ");
    // The read-aloud action speaks the prompt; it does NOT fire the anchor's
    // click handler (no navigation).
    expect(speak).toHaveBeenCalledTimes(1);
    const utter = speak.mock.calls[0][0] as { text: string };
    expect(utter.text).toContain("Read aloud body");
    expect(onActivate).not.toHaveBeenCalledWith("q1-readaloud-click");
    vi.unstubAllGlobals();
  });
});

describe("baseline switch scanning — two switches (step-scan)", () => {
  it("does NOT auto-advance; the advance key moves the highlight, select fires it", () => {
    vi.useFakeTimers();
    const onActivate = vi.fn();
    render(<QuestionHarness config={STEP_SCAN} onActivate={onActivate} />);
    // First target highlighted, and time passing does NOT move it.
    expect(currentTargetId()).toBe("q1-readaloud");
    act(() => vi.advanceTimersByTime(5000));
    expect(currentTargetId()).toBe("q1-readaloud");
    vi.useRealTimers();

    // Advance switch (ArrowRight) steps forward one at a time.
    pressKey("ArrowRight");
    expect(currentTargetId()).toBe("q1-choice-0");
    pressKey("ArrowRight");
    expect(currentTargetId()).toBe("q1-choice-1");
    // Select the highlighted choice.
    pressKey(" ");
    expect(onActivate).toHaveBeenCalledWith("choice-1");
  });
});
