// @vitest-environment jsdom

/**
 * Unmount/cleanup coverage for the baseline listen control.
 *
 * The visible playback state machine, rate clamping, voice mapping and button
 * rendering are exercised elsewhere; this file pins the behaviour a future
 * refactor of the mount effect could silently break: the component must never
 * let speech trail past the screen that started it.
 *
 *   1. When playback is in flight and the component unmounts, the in-flight
 *      browser speech is cancelled (`window.speechSynthesis.cancel()`).
 *   2. When `autoStart` is set and the component unmounts before the deferred
 *      auto-start timer fires, no speech is ever issued — the timer is cleared.
 *
 * Browser speech is the deterministic path to assert against here: jsdom ships
 * no `speechSynthesis`, so we install a fully-spied stub and force the server
 * TTS fetch to reject, which routes playback through the browser fallback.
 */
import * as React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The pill itself is owned by @aivo/ui; stub it to a plain button so this test
// targets BaselineListenAudio's effects, not the design-system component.
vi.mock("@aivo/ui", () => ({
  ReadAloudButton: ({
    playing,
    onToggle,
    disabled,
  }: {
    playing?: boolean;
    onToggle?: () => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={playing ? "Stop reading aloud" : "Read this aloud"}
      aria-pressed={playing || undefined}
    >
      {playing ? "Stop" : "Read aloud"}
    </button>
  ),
}));

import { BaselineListenAudio } from "./listen-audio";

/** A fully-spied stand-in for the platform `speechSynthesis` jsdom lacks. */
function installSpeechSynthesis() {
  const synth = {
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => [] as SpeechSynthesisVoice[]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(window, "speechSynthesis", {
    value: synth,
    configurable: true,
    writable: true,
  });
  class FakeUtterance {
    text: string;
    rate = 1;
    pitch = 1;
    voice: SpeechSynthesisVoice | null = null;
    lang = "";
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  }
  Object.defineProperty(window, "SpeechSynthesisUtterance", {
    value: FakeUtterance,
    configurable: true,
    writable: true,
  });
  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
    FakeUtterance;
  return synth;
}

let synth: ReturnType<typeof installSpeechSynthesis>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  synth = installSpeechSynthesis();
  // Force the server TTS path to fail so playback falls back to browser speech,
  // the deterministic path this test asserts against.
  fetchMock = vi.fn().mockRejectedValue(new Error("tts_unavailable"));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("BaselineListenAudio — audio cleanup on leaving a question", () => {
  it("cancels in-flight speech when the component unmounts mid-playback", async () => {
    const { unmount } = render(
      <BaselineListenAudio learnerId="l1" text="What comes next?" />,
    );

    // Start playback: the click triggers speak(), the mocked fetch rejects, and
    // playback falls back to browser speech.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Read this aloud" }));
    });
    expect(synth.speak).toHaveBeenCalledTimes(1);

    // Ignore the cancel() speak() itself fires before queueing — assert only the
    // unmount path cancels what is now playing.
    synth.cancel.mockClear();
    unmount();
    expect(synth.cancel).toHaveBeenCalledTimes(1);
  });

  it("clears the deferred auto-start timer when unmounted before it fires", () => {
    vi.useFakeTimers();
    try {
      const { unmount } = render(
        <BaselineListenAudio learnerId="l1" text="What comes next?" autoStart />,
      );

      // Unmount before the 150ms deferred auto-start timer fires.
      unmount();

      // Advancing past the deferred delay must not resurrect the cancelled
      // timer: no speech is ever issued (neither server fetch nor browser speak).
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(synth.speak).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("BaselineListenAudio — visible playback controls (idle → playing → paused → idle)", () => {
  /** Start playback via the browser fallback (server fetch is rejected). */
  async function startPlayback() {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Read this aloud" }));
    });
  }

  it("shows Replay + Pause controls only while audio is active", async () => {
    render(<BaselineListenAudio learnerId="l1" text="What comes next?" />);

    // Idle: the extra controls are not in the DOM (no dead affordance).
    expect(screen.queryByRole("button", { name: "Replay from the start" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Pause reading" })).toBeNull();

    // Playing: both controls appear.
    await startPlayback();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Replay from the start" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pause reading" })).toBeTruthy();

    // Stop via the primary pill: back to idle, controls are gone again.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Stop reading aloud" }));
    });
    expect(screen.queryByRole("button", { name: "Replay from the start" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Pause reading" })).toBeNull();
  });

  it("Pause halts the active path and Resume picks it back up", async () => {
    render(<BaselineListenAudio learnerId="l1" text="What comes next?" />);
    await startPlayback();

    // Pause: the browser path's pause() fires and the control flips to Resume.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pause reading" }));
    });
    expect(synth.pause).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Resume reading" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pause reading" })).toBeNull();

    // Resume: the browser path's resume() fires and the control returns to Pause.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Resume reading" }));
    });
    expect(synth.resume).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Pause reading" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Resume reading" })).toBeNull();
  });

  it("Stop after a Pause returns to idle and hides the extra controls", async () => {
    render(<BaselineListenAudio learnerId="l1" text="What comes next?" />);
    await startPlayback();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pause reading" }));
    });
    expect(screen.getByRole("button", { name: "Resume reading" })).toBeTruthy();

    // The primary pill stays a Stop while paused; clicking it returns to idle.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Stop reading aloud" }));
    });
    expect(synth.cancel).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Read this aloud" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Replay from the start" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Resume reading" })).toBeNull();
  });

  it("Replay re-speaks the prompt from the start", async () => {
    render(<BaselineListenAudio learnerId="l1" text="What comes next?" />);
    await startPlayback();
    expect(synth.speak).toHaveBeenCalledTimes(1);

    // Replay issues a fresh utterance (re-speak from the very start).
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Replay from the start" }));
    });
    expect(synth.speak).toHaveBeenCalledTimes(2);
    // Still active afterwards, so the controls remain available.
    expect(screen.getByRole("button", { name: "Pause reading" })).toBeTruthy();
  });
});
