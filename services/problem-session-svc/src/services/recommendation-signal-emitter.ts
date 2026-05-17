/**
 * Sprint 07 trigger: after key problem-session events accumulate, push
 * candidate-generation signals to `@aivo/recommendation-svc`. Flag-gated
 * on `AIVO_FEATURE_PROFILE_RECOMMENDATIONS_V2`.
 *
 * The emitter looks at the most recent events / attempts on a problem
 * session and converts them into the `LearnerSignal` shape consumed by
 * `POST /api/recommendations/candidates`. Nothing is stored locally; the
 * recommendation service decides whether the evidence is sufficient.
 *
 * All errors are swallowed — telemetry-grade integration.
 */

import type {
  ProblemSessionAttemptRecord,
  ProblemSessionEventRecord,
  ProblemSessionRecord,
  ProblemSessionStore,
} from "./problem-session-store.js";

const RECOMMENDATION_SVC_URL =
  process.env.RECOMMENDATION_SVC_URL ?? "http://localhost:3066";

function profileRecommendationsV2Enabled(): boolean {
  const raw = process.env.AIVO_FEATURE_PROFILE_RECOMMENDATIONS_V2;
  if (!raw) return false;
  const v = String(raw).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

interface LearnerSignal {
  source: "lesson" | "homework" | "problem_session";
  metric: string;
  value: number | string | boolean;
  summary: string;
  occurredAt?: string;
}

function buildSignalsFromSession(
  session: ProblemSessionRecord,
  attempts: ProblemSessionAttemptRecord[],
  events: ProblemSessionEventRecord[],
): LearnerSignal[] {
  if (attempts.length === 0) return [];
  const correctCount = attempts.filter((a) => a.correct).length;
  const successRate = correctCount / attempts.length;
  const totalErasers = attempts.reduce((acc, a) => acc + a.eraserCount, 0);
  const totalHints = attempts.reduce((acc, a) => acc + a.hintCount, 0);
  const scratchpadUsed = events.some(
    (e) => e.eventType === "scratchpad_stroke_added" || e.eventType === "surface_snapshot_saved",
  );
  const frustrationSignals = events.filter(
    (e) => e.eventType === "frustration_signal_detected",
  ).length;

  const signals: LearnerSignal[] = [];
  const source: LearnerSignal["source"] =
    session.source === "homework"
      ? "homework"
      : session.source === "lesson"
        ? "lesson"
        : "problem_session";

  if (scratchpadUsed && successRate >= 0.7) {
    signals.push({
      source,
      metric: "scratchpad_success_rate",
      value: successRate,
      summary: `Learner used the scratchpad and reached ${(successRate * 100).toFixed(0)}% correct.`,
      occurredAt: session.completedAt ?? session.updatedAt,
    });
  }
  if (frustrationSignals >= 2) {
    signals.push({
      source: "homework",
      metric: "homework_frustration_count",
      value: frustrationSignals,
      summary: `${frustrationSignals} frustration signals during this session.`,
      occurredAt: session.completedAt ?? session.updatedAt,
    });
  }
  if (totalErasers >= 5) {
    signals.push({
      source: "homework",
      metric: "homework_high_eraser",
      value: totalErasers,
      summary: `High eraser count (${totalErasers}) suggests rework.`,
    });
  }
  if (totalHints >= 3) {
    signals.push({
      source,
      metric: "hint_request_count",
      value: totalHints,
      summary: `Learner requested ${totalHints} hints during this session.`,
    });
  }
  return signals;
}

export async function maybeEmitRecommendationSignals(
  store: ProblemSessionStore,
  problemSessionId: string,
): Promise<void> {
  if (!profileRecommendationsV2Enabled()) return;
  try {
    const session = await store.getSession(problemSessionId);
    if (!session) return;
    const [attempts, events] = await Promise.all([
      store.listAttemptsForSession(problemSessionId),
      store.listEventsForSession(problemSessionId),
    ]);
    const signals = buildSignalsFromSession(session, attempts, events);
    if (signals.length === 0) return;
    await fetch(`${RECOMMENDATION_SVC_URL}/api/recommendations/candidates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        learnerId: session.learnerId,
        signals,
        currentProfile: {},
      }),
    });
  } catch {
    // Recommendation candidate generation must never break the session flow.
  }
}
