import { describe, it, expect, beforeEach } from "vitest";
import type { Beat } from "@aivo/stage-ui";
import { SessionMachine, type TutorSession } from "../SessionMachine.js";

function makeBeats(): Beat[] {
  return [
    {
      id: "b1",
      type: "narration",
      tutorState: "speaking",
      narration: "Welcome!",
    },
    {
      id: "b2",
      type: "interaction",
      tutorState: "thinking",
      interaction: {
        type: "multiple_choice",
        prompt: "Pick A",
        choices: [
          { id: "a", label: "A", isCorrect: true },
          { id: "b", label: "B", isCorrect: false },
        ],
      },
    },
    {
      id: "b3",
      type: "interaction",
      tutorState: "thinking",
      interaction: {
        type: "multiple_choice",
        prompt: "Pick X",
        choices: [
          { id: "x", label: "X", isCorrect: true },
          { id: "y", label: "Y", isCorrect: false },
        ],
      },
    },
    {
      id: "b4",
      type: "celebration",
      tutorState: "celebrating",
      narration: "Great job!",
    },
  ];
}

function makeSession(): TutorSession {
  return {
    sessionId: "sess-1",
    learnerId: "learner-1",
    learnerName: "Lila",
    functioningLevel: "STANDARD",
    beats: makeBeats(),
  };
}

describe("SessionMachine", () => {
  let machine: SessionMachine;

  beforeEach(() => {
    machine = new SessionMachine(makeSession());
  });

  it("starts at the first beat with zero progress", () => {
    expect(machine.currentBeat()?.id).toBe("b1");
    expect(machine.isComplete()).toBe(false);
    expect(machine.progress()).toBe(0);
    const snap = machine.getState();
    expect(snap.totalBeats).toBe(4);
    expect(snap.xpEarned).toBe(0);
    expect(snap.correctCount).toBe(0);
  });

  it("advances through beats in order via nextBeat()", () => {
    expect(machine.nextBeat()?.id).toBe("b2");
    expect(machine.nextBeat()?.id).toBe("b3");
    expect(machine.nextBeat()?.id).toBe("b4");
    // Past the end → null + complete
    expect(machine.nextBeat()).toBeNull();
    expect(machine.isComplete()).toBe(true);
  });

  it("records correct answers, awards XP/coins, and bumps mastery delta positively", () => {
    machine.nextBeat(); // move to b2
    machine.recordAnswer("b2", "a");
    const snap = machine.getState();
    expect(snap.correctCount).toBe(1);
    expect(snap.totalAttempts).toBe(1);
    expect(snap.xpEarned).toBe(10);
    expect(snap.coinsEarned).toBe(1);
    expect(snap.masteryDeltas["multiple_choice"]).toBeCloseTo(0.05);
    expect(snap.answers).toHaveLength(1);
    expect(snap.answers[0]).toMatchObject({ beatId: "b2", isCorrect: true });
  });

  it("records incorrect answers and applies a negative mastery delta", () => {
    machine.nextBeat();
    machine.recordAnswer("b2", "b");
    const snap = machine.getState();
    expect(snap.correctCount).toBe(0);
    expect(snap.totalAttempts).toBe(1);
    expect(snap.xpEarned).toBe(0);
    expect(snap.masteryDeltas["multiple_choice"]).toBeCloseTo(-0.02);
  });

  it("aggregates mastery deltas across multiple interaction beats", () => {
    machine.nextBeat();
    machine.recordAnswer("b2", "a"); // correct
    machine.nextBeat();
    machine.recordAnswer("b3", "y"); // incorrect
    const snap = machine.getState();
    expect(snap.totalAttempts).toBe(2);
    expect(snap.correctCount).toBe(1);
    expect(snap.masteryDeltas["multiple_choice"]).toBeCloseTo(0.05 - 0.02);
  });

  it("ignores recordAnswer for non-interaction beats", () => {
    // b1 is a narration beat
    const result = machine.recordAnswer("b1", "anything");
    expect(result).toBeNull();
    const snap = machine.getState();
    expect(snap.totalAttempts).toBe(0);
    expect(snap.answers).toHaveLength(0);
  });

  it("throws when recordAnswer references an unknown beat id", () => {
    expect(() => machine.recordAnswer("does-not-exist", "x")).toThrow(/unknown beatId/);
  });

  it("marks complete and returns null currentBeat when queue is exhausted", () => {
    machine.nextBeat();
    machine.nextBeat();
    machine.nextBeat();
    machine.nextBeat();
    expect(machine.isComplete()).toBe(true);
    expect(machine.currentBeat()).toBeNull();
    expect(machine.getState().phase).toBe("complete");
    // Subsequent calls are no-ops
    expect(machine.nextBeat()).toBeNull();
    expect(machine.recordAnswer("b2", "a")).toBeNull();
  });

  it("handles a session with zero beats by marking complete immediately", () => {
    const empty = new SessionMachine({
      learnerId: "x",
      functioningLevel: "STANDARD",
      beats: [],
    });
    expect(empty.isComplete()).toBe(true);
    expect(empty.currentBeat()).toBeNull();
    expect(empty.progress()).toBe(1);
  });

  it("restores from a snapshot without losing answer history or mastery", () => {
    machine.nextBeat();
    machine.recordAnswer("b2", "a");
    machine.nextBeat();
    const snap = machine.getState();

    const restored = SessionMachine.restore(makeSession(), snap);
    const restoredSnap = restored.getState();
    expect(restoredSnap.correctCount).toBe(1);
    expect(restoredSnap.totalAttempts).toBe(1);
    expect(restoredSnap.xpEarned).toBe(10);
    expect(restoredSnap.answers).toHaveLength(1);
    expect(restoredSnap.masteryDeltas["multiple_choice"]).toBeCloseTo(0.05);
    expect(restored.currentBeat()?.id).toBe("b3");
  });

  it("rejects invalid construction arguments", () => {
    // @ts-expect-error - intentional bad input
    expect(() => new SessionMachine(undefined)).toThrow();
    expect(
      () =>
        new SessionMachine({
          learnerId: "x",
          functioningLevel: "STANDARD",
          // @ts-expect-error - bad beats
          beats: "not-an-array",
        }),
    ).toThrow(/beats must be an array/);
  });

  it("derives session phase from current beat type", () => {
    expect(machine.getState().phase).toBe("loading");
    machine.nextBeat(); // b2 = interaction
    expect(machine.getState().phase).toBe("core");
    machine.nextBeat();
    machine.nextBeat(); // b4 = celebration
    expect(machine.getState().phase).toBe("celebration");
  });
});

// ── Wave E (S8): agent transition guard ─────────────────────────────────────

describe("proposeTransition (agent guard)", () => {
  function machineAt(level: TutorSession["functioningLevel"] = "STANDARD") {
    const m = new SessionMachine({
      learnerId: "l1",
      functioningLevel: level,
      beats: makeBeats(),
      initialPhase: "core",
    });
    return m;
  }

  it("accepts the legal vocabulary with the right effects", () => {
    const m = machineAt();
    expect(m.proposeTransition({ kind: "advance" })).toEqual({
      accepted: true,
      effect: "advance",
    });
    expect(m.proposeTransition({ kind: "remediate" })).toEqual({
      accepted: true,
      effect: "insert_beat",
    });
    expect(m.proposeTransition({ kind: "say" })).toEqual({
      accepted: true,
      effect: "non_structural",
    });
    expect(m.proposeTransition({ kind: "end_early" })).toEqual({
      accepted: true,
      effect: "end",
    });
  });

  it("rejects unknown kinds with a deterministic alternative", () => {
    const m = machineAt();
    const decision = m.proposeTransition({ kind: "format_disk" });
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(decision.reason).toContain("unknown_action");
      expect(decision.deterministicNext).toBe("advance");
    }
  });

  it("enforces the free-text floor: say is rejected at LOW_VERBAL and below", () => {
    for (const level of ["LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"] as const) {
      const decision = machineAt(level).proposeTransition({ kind: "say" });
      expect(decision.accepted).toBe(false);
      if (!decision.accepted) expect(decision.reason).toBe("say_below_floor");
    }
    expect(machineAt("STANDARD").proposeTransition({ kind: "say" }).accepted).toBe(true);
  });

  it("locks structural inserts during celebration and everything after complete", () => {
    const m = new SessionMachine({
      learnerId: "l1",
      functioningLevel: "STANDARD",
      beats: makeBeats(),
      initialPhase: "celebration",
    });
    const decision = m.proposeTransition({ kind: "remediate" });
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) expect(decision.reason).toBe("celebration_locked");

    m.endEarly("agent stop");
    expect(m.isComplete()).toBe(true);
    expect(m.endedEarlyReason).toBe("agent stop");
    const after = m.proposeTransition({ kind: "advance" });
    expect(after.accepted).toBe(false);
    if (!after.accepted) expect(after.reason).toBe("session_complete");
  });

  it("insertBeat splices a remediation beat after the current one", () => {
    const m = machineAt();
    const before = m.getState().totalBeats;
    m.insertBeat({
      id: "agent-remediate-1",
      type: "narration",
      tutorState: "speaking",
      narration: "Let's look at that one again together.",
    } as never);
    const state = m.getState();
    expect(state.totalBeats).toBe(before + 1);
    expect(state.beats[state.currentBeatIndex + 1]!.id).toBe("agent-remediate-1");
  });

  it("fuzz: 300 random/illegal proposals never mutate the machine", () => {
    const m = machineAt();
    const snapshot = JSON.stringify(m.getState());
    const kinds = [
      "advance", "remediate", "say", "offer_break", "switch_modality",
      "insert_scaffold", "present_surface", "end_early",
      "DROP TABLE", "", "noop", "advance ", "SAY", "🎉",
    ];
    let seed = 1234567;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    for (let i = 0; i < 300; i++) {
      const kind = kinds[Math.floor(rand() * kinds.length)]!;
      const decision = m.proposeTransition({ kind });
      // The guard itself NEVER mutates — accepted effects are applied by
      // the caller; rejected ones carry a deterministic alternative.
      if (!decision.accepted) {
        expect(decision.deterministicNext).toBe("advance");
      }
    }
    expect(JSON.stringify(m.getState())).toBe(snapshot);
  });
});
