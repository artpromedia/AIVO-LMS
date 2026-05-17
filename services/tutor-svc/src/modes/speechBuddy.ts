/**
 * Speech Buddy session lifecycle (interface-only scaffold).
 *
 * The agent-core task (Speech Buddy agent core: STT, planner, dialogue, TTS,
 * safety filter) implements the bodies of these functions. This file exists
 * so other tasks can import a stable surface today.
 *
 * See:
 *   - docs/products/speech-buddy/README.md  (session format)
 *   - docs/products/speech-buddy/safety.md  (consent + safety gating)
 */

import type {
  AgeBand,
  SafetyFlag,
  SkillTag,
  SpeechBuddySession,
  TurnEvent,
} from "@aivo/events";

export interface StartSessionInput {
  tenantId: string;
  /** Raw learner id from the JWT. Will be hashed before any event is emitted. */
  learnerId: string;
  ageBand: AgeBand;
  locale: string;
  /** The verified consent record id from family-svc. Required, never optional. */
  consentRecordId: string;
}

export interface TurnInput {
  sessionId: string;
  /** ASR transcript text for the child's utterance, post-PII-scrubbing. */
  childUtterance: string;
}

export interface TurnOutput {
  /** TTS-ready buddy utterance after both safety filters have passed it. */
  buddyUtterance: string;
  /** The recorded turn event with skill evidence and any flags. */
  turnEvent: TurnEvent;
  /** Next state of the session state machine. */
  nextState: SpeechBuddySession["state"];
}

export interface ReflectionResult {
  badgesAwarded: SkillTag[];
  reflectionPrompts: string[];
}

export interface SessionEndResult {
  durationSeconds: number;
  turnCount: number;
  reflection: ReflectionResult;
  questAssigned?: { quest: string; skill: SkillTag };
  endedReason:
    | "completed"
    | "child_paused"
    | "child_called_grownup"
    | "safety_hard_flag";
  /** Hard-flag summary if the session ended on one (no transcript text). */
  terminalSafetyFlag?: SafetyFlag;
}

/** Start a new Speech Buddy session. Implementation in agent-core task. */
export type StartSpeechBuddySession = (
  input: StartSessionInput,
) => Promise<SpeechBuddySession>;

/** Run one child→buddy turn. Implementation in agent-core task. */
export type RunSpeechBuddyTurn = (input: TurnInput) => Promise<TurnOutput>;

/** End a session and produce reflection + quest. Implementation in agent-core. */
export type EndSpeechBuddySession = (
  sessionId: string,
  reason: SessionEndResult["endedReason"],
) => Promise<SessionEndResult>;

export const SPEECH_BUDDY_MODE_ID = "speech_buddy" as const;
