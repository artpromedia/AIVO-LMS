// @vitest-environment jsdom

/**
 * Sprint 12 — transition tests for the lesson player's beat machine.
 *
 * The hook is exercised through renderHook with the Sprint 08 mutations
 * module mocked at its seam (LessonRunApi), so every assertion runs against
 * the real machine logic: beat ordering, story omission, ?step= resume,
 * answer feedback + counters, hint/scaffold tracking, break interrupt /
 * resume / reminder, and the completion payload shape.
 */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LessonRunApi } from "../lesson-player-mutations";
import type { GeneratedLessonPlan } from "@/lib/db/types";

const routerPush = vi.fn();
const routerRefresh = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
  useSearchParams: () => searchParams,
}));

const stableT = Object.assign(
  (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
  { rich: (key: string) => key, markup: (key: string) => key, raw: (key: string) => key },
);
vi.mock("next-intl", () => ({ useTranslations: (_ns?: string) => stableT }));

vi.mock("@/lib/use-toast", () => ({ toast: vi.fn() }));

const api: { [K in keyof LessonRunApi]: ReturnType<typeof vi.fn> } = {
  markStarted: vi.fn(),
  postStep: vi.fn(),
  postSurfaceTelemetry: vi.fn(),
  complete: vi.fn(async (_body: Record<string, unknown>) => ({ done: true })),
};
vi.mock("../lesson-player-mutations", () => ({
  createLessonRunApi: () => api,
}));

import { useBeatMachine, BREAK_REMINDER_MS } from "./use-beat-machine";
import type { AccessibilityPreferences, LessonRunStatus } from "@/lib/db/types";

const plan = {
  title: "Adding within 10",
  objective: "Add two numbers within 10.",
  tutorPersona: "Nova",
  tutorGreeting: "Hi! Ready to add?",
  storyHook: "Two squirrels gathered acorns…",
  microLesson: "Counting on means starting from the bigger number.",
  example: { prompt: "3 + 4", explanation: "Start at 4, count on 3: 5, 6, 7." },
  guidedPractice: [
    {
      id: "gp-1",
      prompt: "What is 2 + 3?",
      expectedAnswer: "5",
      hint: "Start at 3 and count on 2.",
      scaffold: "Use your fingers: 3… 4, 5.",
      skillId: "add-10",
    },
  ],
  checksForUnderstanding: [
    { id: "chk-1", prompt: "What is 4 + 4?", expectedAnswer: "8", supportIfWrong: "Count 4 past 4." },
    { id: "chk-2", prompt: "What is 5 + 2?", expectedAnswer: "7", supportIfWrong: "Count 2 past 5." },
  ],
  encouragement: "You did it!",
  parentSummary: "Practiced adding within 10.",
  nextRecommendedStep: "Adding within 20.",
  estimatedMinutes: 10,
} as unknown as GeneratedLessonPlan;

const baseAccessibility = {
  reducedMotion: false,
  highContrast: false,
  largeText: false,
  audioFirst: false,
  captionsAlwaysOn: false,
  hapticsEnabled: false,
  readAloud: false,
  dyslexiaFriendlyFont: false,
  shorterSteps: false,
  extraHints: false,
  visualSupports: false,
  breakReminders: false,
  keyboardOptimized: false,
  aacEnabled: false,
} as unknown as AccessibilityPreferences;

function mount(
  overrides: Partial<AccessibilityPreferences> = {},
  opts: { initialStatus?: LessonRunStatus; step?: string } = {},
) {
  searchParams = new URLSearchParams(opts.step !== undefined ? { step: opts.step } : {});
  return renderHook(() =>
    useBeatMachine({
      learnerId: "lrn-1",
      lessonRunId: "run-1",
      plan,
      accessibility: { ...baseAccessibility, ...overrides },
      initialStatus: opts.initialStatus ?? "ready",
      agent: null,
    }),
  );
}

const submit = (answer: string) => ({
  response: { answer },
  isCorrect: null,
  surfaceId: "s",
  occurredAt: new Date().toISOString(),
});

beforeEach(() => {
  vi.clearAllMocks();
  api.complete.mockImplementation(async () => ({ done: true }));
  window.history.replaceState({}, "", "/lesson");
});
afterEach(cleanup);

describe("useBeatMachine — beat order", () => {
  it("derives the full beat order from the plan", () => {
    const { result } = mount();
    expect(result.current.beats.map((b) => b.kind)).toEqual([
      "welcome",
      "goal",
      "story",
      "micro",
      "example",
      "guided",
      "check",
      "check",
      "celebrate",
      "progress",
      "next",
    ]);
    expect(result.current.stepIdx).toBe(0);
    expect(result.current.isLastBeat).toBe(false);
    expect(api.markStarted).toHaveBeenCalledTimes(1);
  });

  it("omits the story beat under shorterSteps", () => {
    const { result } = mount({ shorterSteps: true } as Partial<AccessibilityPreferences>);
    expect(result.current.beats.map((b) => b.kind)).not.toContain("story");
    expect(result.current.beats).toHaveLength(10);
  });

  it("does not mark started when the run is already in progress", () => {
    mount({}, { initialStatus: "in_progress" });
    expect(api.markStarted).not.toHaveBeenCalled();
  });
});

describe("useBeatMachine — advance / back / resume", () => {
  it("advances in order, clearing feedback and hints, and stops at the end", () => {
    const { result } = mount();
    act(() => result.current.advance());
    expect(result.current.stepIdx).toBe(1);
    act(() => result.current.back());
    expect(result.current.stepIdx).toBe(0);
    act(() => result.current.back());
    expect(result.current.stepIdx).toBe(0); // floor at 0

    for (let i = 0; i < 50; i += 1) act(() => result.current.advance());
    expect(result.current.stepIdx).toBe(result.current.beats.length - 1);
    expect(result.current.isLastBeat).toBe(true);
  });

  it("resumes from ?step= and clamps out-of-range values", () => {
    const a = mount({}, { step: "4" });
    expect(a.result.current.stepIdx).toBe(4);
    a.unmount();

    const b = mount({}, { step: "999" });
    expect(b.result.current.stepIdx).toBe(b.result.current.beats.length - 1);
    b.unmount();

    const c = mount({}, { step: "-2" });
    expect(c.result.current.stepIdx).toBe(0);
  });

  it("mirrors the current step into the URL and posts one step view per beat", () => {
    const { result } = mount();
    expect(window.location.search).toContain("step=0");
    expect(api.postStep).toHaveBeenCalledWith({ stepKind: "intro", stepRefId: null });

    act(() => result.current.advance());
    expect(window.location.search).toContain("step=1");

    act(() => result.current.back());
    act(() => result.current.advance());
    // Beat 1 was already seen — exactly one "intro" post for it.
    const views = api.postStep.mock.calls.filter(([p]) => p.stepKind === "intro");
    expect(views).toHaveLength(2); // beat 0 + beat 1, deduped on revisit
  });
});

describe("useBeatMachine — answers, hints, scaffolds", () => {
  function goToGuided(result: { current: ReturnType<typeof useBeatMachine> }) {
    while (result.current.beat.kind !== "guided") act(() => result.current.advance());
  }

  it("grades against expectedAnswer with normalization and records the step", () => {
    const { result } = mount();
    goToGuided(result);
    expect(result.current.isInteractive).toBe(true);

    act(() => result.current.submitSurface(submit("  5 ")));
    expect(result.current.feedback).toBe("correct");
    expect(api.postStep).toHaveBeenCalledWith(
      expect.objectContaining({
        stepKind: "answer_submitted",
        stepRefId: "gp-1",
        response: "  5 ",
        isCorrect: true,
      }),
    );

    act(() => result.current.advance());
    expect(result.current.feedback).toBeNull();
  });

  it("marks a wrong answer incorrect, then correct on retry", () => {
    const { result } = mount();
    goToGuided(result);
    act(() => result.current.submitSurface(submit("4")));
    expect(result.current.feedback).toBe("incorrect");
    act(() => result.current.submitSurface(submit("5")));
    expect(result.current.feedback).toBe("correct");
  });

  it("tracks hint and scaffold usage on guided beats only", () => {
    const { result } = mount();
    act(() => result.current.requestHint()); // welcome beat — ignored
    expect(result.current.showHint).toBe(false);

    goToGuided(result);
    act(() => result.current.requestHint());
    expect(result.current.showHint).toBe(true);
    expect(api.postStep).toHaveBeenCalledWith({ stepKind: "hint_used", stepRefId: "gp-1" });

    act(() => result.current.useScaffold());
    expect(api.postStep).toHaveBeenCalledWith({ stepKind: "scaffold_used", stepRefId: "gp-1" });
  });

  it("shows the hint automatically on guided beats under extraHints", () => {
    const { result } = mount({ extraHints: true } as Partial<AccessibilityPreferences>);
    expect(result.current.showHint).toBe(false);
    goToGuided(result);
    expect(result.current.showHint).toBe(true);
  });
});

describe("useBeatMachine — breaks", () => {
  it("interrupts and resumes without losing the current beat", () => {
    const { result } = mount();
    act(() => result.current.advance());
    act(() => result.current.startBreak());
    expect(result.current.onBreak).toBe(true);
    act(() => result.current.endBreak());
    expect(result.current.onBreak).toBe(false);
    expect(result.current.stepIdx).toBe(1);
  });

  it("routes into the break screen on the reminder cadence", () => {
    vi.useFakeTimers();
    try {
      const { result } = mount({ breakReminders: true } as Partial<AccessibilityPreferences>);
      expect(result.current.onBreak).toBe(false);
      act(() => vi.advanceTimersByTime(BREAK_REMINDER_MS));
      expect(result.current.onBreak).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("useBeatMachine — completion", () => {
  it("sends the completion payload shape the mutations module expects", async () => {
    const { result } = mount();
    act(() => result.current.complete(false));
    await waitFor(() => expect(api.complete).toHaveBeenCalled());

    // Assert against LessonRunApi["complete"]'s input: the client sends
    // ONLY the abandoned flag (server derives counters from interactions);
    // no agentSessionId without an agent.
    const body: Parameters<LessonRunApi["complete"]>[0] = api.complete.mock.calls[0][0];
    expect(body).toEqual({ outcome: { abandoned: false } });
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/learner/home"));
    expect(routerRefresh).toHaveBeenCalled();
  });

  it("flags abandonment when ending from a break", async () => {
    const { result } = mount();
    act(() => result.current.startBreak());
    act(() => result.current.complete(true));
    await waitFor(() => expect(api.complete).toHaveBeenCalled());
    expect(api.complete.mock.calls[0][0]).toEqual({ outcome: { abandoned: true } });
  });

  it("surfaces an inline error and stays put when completion fails", async () => {
    api.complete.mockImplementation(async () => ({ done: false }));
    const { result } = mount();
    act(() => result.current.complete(false));
    await waitFor(() => expect(result.current.completeError).toBe("complete_error"));
    expect(routerPush).not.toHaveBeenCalled();
  });
});
