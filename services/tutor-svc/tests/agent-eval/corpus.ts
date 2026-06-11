/**
 * Wave E (S13) — the offline agent-eval corpus.
 *
 * Data-driven session fixtures replayed through the REAL orchestrator for
 * EVERY onboarded tutor × functioning level (tests/agent-eval runner).
 * Each scenario fixes: the lesson observation, the (scripted) model
 * proposal, and the EXPECTED decision envelope — so a regression in
 * policy filtering, the SessionMachine guard, the snapshot triggers, or
 * the ladder shows up as a named scenario failing for a named tutor,
 * not as a vague behavioural drift.
 *
 * The corpus is intentionally model-free (proposals are scripted): it
 * certifies the DECISION PIPELINE per tutor. Model quality is governed
 * separately (ai-svc red-team suite + the quality gate).
 */
import type { TutorFunctioningLevel } from "@aivo/tutor-sdk";
import type { AgentWireAction, LessonObservation } from "../../src/agent/orchestrator.js";

export interface EvalScenario {
  id: string;
  description: string;
  /** Levels the scenario applies to (intersected with the tutor's). */
  levels: TutorFunctioningLevel[];
  observation: (level: TutorFunctioningLevel) => LessonObservation;
  /** The scripted model proposal for this scenario. */
  proposal: AgentWireAction;
  expect: {
    kind: "action" | "deterministic";
    /** For accepted actions: the machine effect that must result. */
    effect?: "advance" | "insert_beat" | "non_structural" | "end";
    /** For deterministic outcomes: the reason that must be reported. */
    reason?: string;
    /** The first model call must carry a pre-seeded learner snapshot. */
    snapshotPreSeeded?: boolean;
  };
}

function baseObservation(overrides: Partial<LessonObservation> = {}): LessonObservation {
  return {
    beatIndex: 4,
    totalBeats: 8,
    beatKind: "guided",
    beatKinds: [
      "welcome",
      "goal",
      "micro",
      "example",
      "guided",
      "guided",
      "check",
      "celebrate",
    ],
    prompt: "Practice item",
    learnerResponse: "an answer",
    isCorrect: false,
    recentMissStreak: 0,
    secondsOnBeat: 15,
    skillId: "eval.skill.1",
    ...overrides,
  };
}

export const EVAL_SCENARIOS: EvalScenario[] = [
  {
    id: "miss_streak_remediation",
    description:
      "Two misses on the same idea → the tutor proposes remediation; the guard must accept it as an inserted beat and the stale snapshot must be refreshed.",
    levels: ["STANDARD", "SUPPORTED"],
    observation: () => baseObservation({ recentMissStreak: 2, attemptsOnBeat: 2 }),
    proposal: { kind: "remediate", focus: "the core idea, re-taught", approach: "worked_example" },
    expect: { kind: "action", effect: "insert_beat", snapshotPreSeeded: true },
  },
  {
    id: "frustration_break_offer",
    description:
      "A frustration event → the tutor offers a break; render-only move, accepted, with a fresh snapshot pre-seeded.",
    levels: ["STANDARD", "SUPPORTED", "LOW_VERBAL"],
    observation: () => baseObservation({ frustrationEvent: true }),
    proposal: { kind: "offer_break", reason: "frustration", duration_seconds: 60 },
    expect: { kind: "action", effect: "non_structural", snapshotPreSeeded: true },
  },
  {
    id: "say_floor_holds",
    description:
      "A (misbehaving) model proposes free-text say below the verbal floor → the machine must reject it deterministically.",
    levels: ["LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"],
    observation: () => baseObservation({ isCorrect: true }),
    proposal: { kind: "say", text: "improvised prose that must never render" },
    expect: { kind: "deterministic", reason: "guard_say_below_floor" },
  },
  {
    id: "on_track_advance",
    description:
      "Correct answer, no stress signals → advance with encouragement is accepted and nothing is pre-seeded.",
    levels: ["STANDARD", "SUPPORTED", "LOW_VERBAL"],
    observation: () => baseObservation({ isCorrect: true, recentMissStreak: 0 }),
    proposal: { kind: "advance", encouragement: "Strong work — keep going." },
    expect: { kind: "action", effect: "advance", snapshotPreSeeded: false },
  },
  {
    id: "celebration_locked",
    description:
      "During the wind-down the model proposes new instruction → the celebration lock must refuse it.",
    levels: ["STANDARD", "SUPPORTED"],
    observation: (level) =>
      baseObservation({
        beatIndex: 7,
        beatKind: "check",
        isCorrect: true,
        // Index 7 is the celebrate beat — structurally locked.
        beatKinds: [
          "welcome",
          "goal",
          "micro",
          "example",
          "guided",
          "guided",
          "check",
          "celebrate",
        ],
        recentMissStreak: level === "STANDARD" ? 0 : 0,
      }),
    proposal: { kind: "insert_scaffold", scaffold: "One more practice idea" },
    expect: { kind: "deterministic", reason: "guard_celebration_locked" },
  },
];
