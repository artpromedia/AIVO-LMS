/**
 * Mobile session runtime types.
 *
 * Mirrors the shape that learning-svc returns from
 * GET /api/learning/sessions/:sessionId. Sprint 03+ continues to evolve the
 * beat union (surface, math expression, free response, etc.).
 */

import type { LearnerSurfaceSpec } from "./learnerSurface";

export type SessionStatus =
  | "CONTENT_GENERATING"
  | "CONTENT_READY"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ABANDONED";

export type FunctioningLevel = "EARLY" | "MIDDLE" | "HIGH" | "ADVANCED";

export interface SessionMeta {
  id: string;
  learnerId: string;
  tutorSku: string;
  subject: string;
  topic?: string;
  status: SessionStatus;
  functioningLevel: FunctioningLevel | string;
  startedAt?: string;
  completedAt?: string | null;
}

/* ------------------------------------------------------------------ */
/* Beat union                                                         */
/* ------------------------------------------------------------------ */

export interface BeatBase {
  id: string;
  /** Optional human-readable label used for analytics / debugging. */
  label?: string;
  /** Tutor mascot line shown before the learner interacts. */
  prompt?: string;
}

export interface ChoiceBeat extends BeatBase {
  kind: "choice";
  text: string;
  options: string[];
  correctAnswer: string;
  /** Optional skill tag used by the gradebook. */
  skill?: string;
}

export interface MathExpressionBeat extends BeatBase {
  kind: "math-expression";
  text: string;
  /** Canonical answer expression (server validates). */
  canonicalAnswer?: string;
  skill?: string;
}

export interface SurfaceBeat extends BeatBase {
  kind: "surface";
  surface: LearnerSurfaceSpec;
  text?: string;
  skill?: string;
}

export interface TutorTurnBeat extends BeatBase {
  kind: "tutor-turn";
  /** Text spoken by the tutor mascot — no learner response required. */
  text: string;
}

export type Beat = ChoiceBeat | MathExpressionBeat | SurfaceBeat | TutorTurnBeat;

/* ------------------------------------------------------------------ */
/* Session                                                            */
/* ------------------------------------------------------------------ */

export interface StagePlan {
  beats: Beat[];
}

export interface Session {
  meta: SessionMeta;
  stagePlan: StagePlan;
}

/* ------------------------------------------------------------------ */
/* Learner response (POSTed back to the server)                       */
/* ------------------------------------------------------------------ */

export type LearnerResponse =
  | { beatId: string; kind: "choice"; answer: string; correct: boolean }
  | { beatId: string; kind: "math-expression"; answer: string; correct: boolean | null }
  | { beatId: string; kind: "surface"; surfaceCommands: unknown; correct: boolean | null }
  | { beatId: string; kind: "tutor-turn"; acknowledged: true };
