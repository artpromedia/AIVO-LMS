import type { LearningEventBase, LearningEventType } from "./learning-events.js";

export interface ProblemSessionStartedPayload {
  problemSessionId: string;
  subject: string;
  skillCode?: string;
  standardCode?: string;
  source: "baseline" | "lesson" | "homework" | "tutor_chat" | "practice";
  sourceSessionId?: string;
  tutorSku?: string;
}

export interface ProblemSessionCompletedPayload {
  problemSessionId: string;
  durationMs: number;
  attempts: number;
  correctAttempts: number;
  score?: number;
}

export interface SurfaceRenderedPayload {
  problemSessionId: string;
  surfaceId: string;
  surfaceType: string;
}

export interface AnswerAttemptedPayload {
  problemSessionId: string;
  attemptNumber: number;
  correct: boolean;
  score?: number;
  latencyMs: number;
  hintCount: number;
}

export interface HintRequestedPayload {
  problemSessionId: string;
  hintLevel: number;
  hintType: "micro" | "scaffolded" | "worked_example";
}

export interface SurfaceSnapshotSavedPayload {
  problemSessionId: string;
  surfaceId: string;
  snapshotType: "ink" | "diagram" | "annotation" | "text" | "answer";
  strokeCount: number;
  storageUrl?: string;
}

export interface FrustrationSignalPayload {
  problemSessionId: string;
  signal:
    | "inactivity"
    | "repeated_wrong"
    | "high_eraser"
    | "long_latency"
    | "many_hints"
    | "abandoned";
  evidence: string;
}

export type ProblemSessionEvent<TType extends LearningEventType = LearningEventType> =
  TType extends "problem_session_started"
    ? LearningEventBase<ProblemSessionStartedPayload>
    : TType extends "problem_session_completed"
      ? LearningEventBase<ProblemSessionCompletedPayload>
      : TType extends "surface_rendered"
        ? LearningEventBase<SurfaceRenderedPayload>
        : TType extends "answer_attempted"
          ? LearningEventBase<AnswerAttemptedPayload>
          : TType extends "hint_requested"
            ? LearningEventBase<HintRequestedPayload>
            : TType extends "surface_snapshot_saved"
              ? LearningEventBase<SurfaceSnapshotSavedPayload>
              : TType extends "frustration_signal_detected"
                ? LearningEventBase<FrustrationSignalPayload>
                : LearningEventBase;
