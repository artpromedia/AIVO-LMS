// @vitest-environment jsdom

/**
 * Tests for the baseline read-aloud island (`BaselineListenAudio`).
 *
 * Three concerns are covered:
 *
 *   1. Audio cleanup on leaving a question — in-flight browser speech is
 *      cancelled on unmount, and the deferred auto-start timer is cleared so
 *      speech never trails past the screen that started it.
 *   2. Visible playback controls — Replay / Pause / Resume appear only while
 *      audio is active and drive the underlying playback path.
 *   3. Captions — the visible caption line tracks the `<audio>` playback
 *      position (and holds the final line past the last boundary), the full
 *      transcript stays visible while idle ONLY when the learner's
 *      `captionsAlways` preference is on, and the browser-voice fallback shows
 *      no captions because that path has no caption timings.
 *
 * The pill itself is owned by @aivo/ui and stubbed to a plain button so these
 * tests target BaselineListenAudio's effects, not the design-system component.
 * jsdom ships no Web Speech API, so a fully-spied `speechSynthesis` +
 * `SpeechSynthesisUtterance` are installed; `<audio>` is a fake so the caption
 * suite can drive `currentTime` and fire the handlers directly. The server clip
 * is mocked at the `fetch` boundary using the real `/api/bff/learners/:id/tts`
 * response shape; caption objects mirror `fakeCaptions` from
 * `lib/tts/provider.ts`. By default `fetch` rejects (routing playback through
 * the deterministic browser fallback the cleanup/controls suites assert
 * against); the caption suite overrides `fetch` per-test with a success.
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

type Caption = { startMs: number; endMs: number; text: string };

const CAPTIONS: Caption[] = [
  { startMs: 0, endMs: 1000, text: "First line." },
  { startMs: 1000, endMs: 2000, text: "Second line." },
];
const TRANSCRIPT = "First line. Second line.";

/**
 * Minimal `<audio>` stand-in. Records the handlers the component assigns so the
 * test can fire `timeupdate`/`ended` after setting `currentTime`, and resolves
 * `play()` like a successful clip.
 */
class FakeAudio {
  static instances: FakeAudio[] = [];
  currentTime = 0;
  playbackRate = 1;
  src = "";
  onended: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  constructor() {
    FakeAudio.instances.push(this);
  }
}

/** A successful server TTS response carrying the canned captions. */
function ttsOkResponse(captions: Caption[] = CAPTIONS) {
  return {
    ok: true,
    json: async () => ({
      ok: true,
      data: { asset: { storageKey: "data:audio/mpeg;base64,AAAA", captions } },
    }),
  };
}

function getAudio(): FakeAudio {
  const a = FakeAudio.instances.at(-1);
  if (!a) throw new Error("no <audio> instance was created");
  return a;
}

function caption(): HTMLElement | null {
  return screen.queryByTestId("baseline-listen-caption");
}

/** Click the read-aloud pill and flush the async server generation. */
async function startReadAloud() {
  await act(async () => {
    fireEvent.click(screen.getByLabelText("Read this aloud"));
  });
}

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
  FakeAudio.instances = [];
  vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);
  // Default: force the server TTS path to fail so playback falls back to
  // browser speech, the deterministic path the cleanup/controls suites assert
  // against. The caption suite overrides fetch per-test with a success.
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

describe("BaselineListenAudio — playback controls drive the server <audio> path", () => {
  /** Start playback with a successful server clip so the <audio> path is live. */
  async function startServerPlayback() {
    vi.stubGlobal("fetch", vi.fn(async () => ttsOkResponse()));
    await startReadAloud();
  }

  it("Replay restarts the server clip from the very start", async () => {
    render(<BaselineListenAudio learnerId="lrn_1" text={TRANSCRIPT} />);
    await startServerPlayback();

    const audio = getAudio();
    // Initial play fired once; the controls are visible while the clip plays.
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Replay from the start" })).toBeTruthy();

    // Advance the clip, then Replay — the same <audio> element rewinds to 0 and
    // plays again (no new clip generated; the cached server src is reused).
    act(() => {
      audio.currentTime = 1.2;
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Replay from the start" }));
    });
    expect(FakeAudio.instances).toHaveLength(1);
    expect(audio).toBe(getAudio());
    expect(audio.currentTime).toBe(0);
    expect(audio.play).toHaveBeenCalledTimes(2);
    // No browser fallback was used — the server path stayed in control.
    expect(synth.speak).not.toHaveBeenCalled();
    // Still active, so the controls remain available.
    expect(screen.getByRole("button", { name: "Pause reading" })).toBeTruthy();
  });

  it("Pause then Resume toggles the <audio> element and flips the button", async () => {
    render(<BaselineListenAudio learnerId="lrn_1" text={TRANSCRIPT} />);
    await startServerPlayback();

    const audio = getAudio();
    expect(audio.play).toHaveBeenCalledTimes(1);

    // Pause: the <audio> element is paused and the control flips to Resume.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pause reading" }));
    });
    expect(audio.pause).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Resume reading" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pause reading" })).toBeNull();
    // The browser voice is never engaged on the server path.
    expect(synth.pause).not.toHaveBeenCalled();

    // Resume: the same <audio> element plays on (no rewind) and the control
    // returns to Pause.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Resume reading" }));
    });
    expect(audio.play).toHaveBeenCalledTimes(2);
    expect(audio).toBe(getAudio());
    expect(screen.getByRole("button", { name: "Pause reading" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Resume reading" })).toBeNull();
    expect(synth.resume).not.toHaveBeenCalled();
  });

  it("Stop pill returns the server path to idle and hides the controls", async () => {
    render(<BaselineListenAudio learnerId="lrn_1" text={TRANSCRIPT} />);
    await startServerPlayback();

    const audio = getAudio();
    expect(screen.getByRole("button", { name: "Replay from the start" })).toBeTruthy();

    // Stop: the <audio> element rewinds + pauses and the component resets to idle.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Stop reading aloud" }));
    });
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.currentTime).toBe(0);
    expect(screen.getByRole("button", { name: "Read this aloud" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Replay from the start" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Pause reading" })).toBeNull();
  });
});

describe("BaselineListenAudio captions", () => {
  it("advances the visible caption line as audio playback position moves", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ttsOkResponse()));
    render(<BaselineListenAudio learnerId="lrn_1" text={TRANSCRIPT} />);

    await startReadAloud();
    const audio = getAudio();

    // 0.5s in → first line is active.
    act(() => {
      audio.currentTime = 0.5;
      audio.ontimeupdate?.();
    });
    expect(caption()?.textContent).toBe("First line.");

    // 1.5s in → second line is active.
    act(() => {
      audio.currentTime = 1.5;
      audio.ontimeupdate?.();
    });
    expect(caption()?.textContent).toBe("Second line.");

    // Past the last boundary → hold on the final line (not blank).
    act(() => {
      audio.currentTime = 2.5;
      audio.ontimeupdate?.();
    });
    expect(caption()?.textContent).toBe("Second line.");
  });

  it("keeps the full transcript visible while idle only when captionsAlways is on", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ttsOkResponse()));
    const { rerender } = render(
      <BaselineListenAudio learnerId="lrn_1" text={TRANSCRIPT} captionsAlways />,
    );

    await startReadAloud();
    // While the clip plays we show the synced line, not the whole transcript.
    act(() => {
      getAudio().currentTime = 0.5;
      getAudio().ontimeupdate?.();
    });
    expect(caption()?.textContent).toBe("First line.");

    // Playback ends → idle. With captionsAlways on, the full transcript stays.
    act(() => {
      getAudio().onended?.();
    });
    expect(caption()?.textContent).toBe(TRANSCRIPT);

    // Same idle state with captionsAlways off → no caption at all.
    rerender(
      <BaselineListenAudio learnerId="lrn_1" text={TRANSCRIPT} captionsAlways={false} />,
    );
    expect(caption()).toBeNull();
  });

  it("does not show the transcript while idle before any clip is generated", () => {
    vi.stubGlobal("fetch", vi.fn(async () => ttsOkResponse()));
    render(<BaselineListenAudio learnerId="lrn_1" text={TRANSCRIPT} captionsAlways />);
    // Nothing has played yet — there are no captions to show.
    expect(caption()).toBeNull();
  });

  it("shows no captions on the browser-voice fallback (server generation failed)", async () => {
    // Server generation fails → component falls back to the browser voice,
    // which has no caption timings.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    render(<BaselineListenAudio learnerId="lrn_1" text={TRANSCRIPT} captionsAlways />);

    await startReadAloud();

    // No <audio> clip was played, and no caption is rendered despite
    // captionsAlways being on.
    expect(FakeAudio.instances).toHaveLength(0);
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(caption()).toBeNull();
  });
});
