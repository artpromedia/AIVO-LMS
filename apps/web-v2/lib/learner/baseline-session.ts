/**
 * Streaming-baseline orchestrator (runner cutover).
 *
 * The runner renders one question per server round-trip, so this drives
 * the assessment-svc session in that same cadence:
 *
 *   1. Ensure a session exists (start on first render; resume via /active).
 *   2. Reconcile — forward every web-v2 attempt the server hasn't seen yet
 *      through `respond`, in order, so the server-side θ state catches up
 *      to what the learner has actually answered.
 *   3. Return the next question the server selected (or null when the run
 *      should end).
 *
 * Any failure (no token, transport error, integrity rejection, lost
 * session) returns `{ mode: "fallback" }` so the runner reverts to the
 * local adaptive path — the streaming path can never harden into a dead
 * end. The candidate bank is built from the persisted question set, so the
 * server's item ids are web-v2 question ids and map straight back.
 */
import type { BaselineItem } from "@aivo/adaptive-baseline";
import type {
  BaselineAssessment,
  BaselineAttempt,
  BaselineQuestion,
  LearnerProfile,
} from "@/lib/db/types";
import {
  priorThetaForLearner,
  learnerHasReadingDifficulty,
  type CalibrationMap,
} from "./baseline-adaptive";
import {
  questionsToBank,
  startAdaptiveBaselineRun,
  respondAdaptiveBaselineRun,
  activeAdaptiveBaselineRun,
  type StartRunResult,
  type RespondRunResult,
  type ActiveRunResult,
} from "./baseline-stream";

/** The subset of the stream client the orchestrator needs (injectable). */
export interface StreamClient {
  start(input: {
    learnerId: string;
    bank: BaselineItem[];
    priorTheta?: number;
    readingDifficulty?: boolean;
  }): Promise<StartRunResult>;
  respond(input: {
    learnerId: string;
    sessionId: string;
    item: BaselineItem;
    response: { itemId: string; correct: boolean; responseTimeMs: number };
    bank: BaselineItem[];
  }): Promise<RespondRunResult>;
  active(input: { learnerId: string }): Promise<ActiveRunResult>;
}

/** Build a StreamClient backed by real HTTP calls to assessment-svc. */
export function makeHttpStreamClient(authToken: string, baseUrl?: string): StreamClient {
  return {
    start: (i) => startAdaptiveBaselineRun({ ...i, authToken, baseUrl }),
    respond: (i) => respondAdaptiveBaselineRun({ ...i, authToken, baseUrl }),
    active: (i) => activeAdaptiveBaselineRun({ ...i, authToken, baseUrl }),
  };
}

export interface StreamNextInput {
  learnerId: string;
  baseline: BaselineAssessment;
  questions: BaselineQuestion[];
  attempts: BaselineAttempt[];
  learner: LearnerProfile | null;
  client: StreamClient;
  /** Persist the session id on the baseline (called once when a run starts). */
  persistSessionId: (sessionId: string) => Promise<void> | void;
  calibration?: CalibrationMap;
  /**
   * Web subject id → slug (Wave C, G1) so bank items carry
   * canonicalisable subject keys and the service finalizer can split
   * per-subject θ.
   */
  subjectSlugById?: ReadonlyMap<string, string>;
}

export type StreamOutcome =
  | { mode: "streaming"; next: BaselineQuestion | null; sessionId: string }
  | { mode: "fallback"; reason: string };

/**
 * Advance the server session to match the learner's answers and return the
 * next question to render. Pure w.r.t. the injected `client`, so it is
 * fully unit-testable against a fake service.
 */
export async function streamNextQuestion(input: StreamNextInput): Promise<StreamOutcome> {
  const { learnerId, baseline, questions, attempts, learner, client, calibration } = input;

  const bank = questionsToBank(questions, calibration, input.subjectSlugById);
  const bankById = new Map(bank.map((b) => [b.id, b]));
  const questionById = new Map(questions.map((q) => [q.id, q]));
  // Apply answers in the order they were given (the order the server served them).
  const ordered = [...attempts].sort((a, b) => a.respondedAt.localeCompare(b.respondedAt));

  try {
    let sessionId = baseline.adaptiveSessionId;
    let administered = 0; // answers the server has already absorbed
    let served: BaselineItem | null = null;
    let stopped = false;

    if (!sessionId) {
      const started = await client.start({
        learnerId,
        bank,
        priorTheta: priorThetaForLearner(learner),
        readingDifficulty: learnerHasReadingDifficulty(learner),
      });
      if (!started.ok) return { mode: "fallback", reason: started.reason };
      sessionId = started.sessionId;
      served = started.nextItem;
      stopped = started.stop.stop;
      await input.persistSessionId(sessionId);
    } else {
      const active = await client.active({ learnerId });
      if (!active.ok || !active.active) {
        return { mode: "fallback", reason: active.ok ? "session_inactive" : active.reason };
      }
      administered = active.itemsAdministered ?? 0;
      served = active.lastServedItemId ? (bankById.get(active.lastServedItemId) ?? null) : null;
      stopped = active.stop?.stop ?? false;
    }

    // Forward any answers the server hasn't seen yet, in order.
    for (let i = administered; i < ordered.length; i++) {
      const attempt = ordered[i]!;
      const item = bankById.get(attempt.questionId);
      if (!item) return { mode: "fallback", reason: "unknown_attempt_item" };
      const res = await client.respond({
        learnerId,
        sessionId,
        item,
        response: {
          itemId: item.id,
          // A skip carries no correctness signal; treat as incorrect for θ.
          correct: attempt.skipped ? false : attempt.isCorrect,
          responseTimeMs: attempt.latencyMs ?? 0,
        },
        bank,
      });
      if (!res.ok) return { mode: "fallback", reason: res.reason };
      served = res.nextItem;
      stopped = res.stop.stop;
    }

    if (stopped) return { mode: "streaming", next: null, sessionId };
    const next = served ? (questionById.get(served.id) ?? null) : null;
    return { mode: "streaming", next, sessionId };
  } catch (err) {
    return { mode: "fallback", reason: err instanceof Error ? err.message : "stream_error" };
  }
}
