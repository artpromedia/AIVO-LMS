import { redactForLogging } from "./safe-logger.js";

export const LEARNING_TRACE_EVENTS = [
  "lesson_generation_started",
  "lesson_generation_completed",
  "homework_adaptation_started",
  "homework_adaptation_completed",
  "profile_recommendation_generated",
  "surface_command_rejected",
  "responsible_ai_violation_detected",
  "problem_session_completed",
] as const;

export type LearningTraceEvent = (typeof LEARNING_TRACE_EVENTS)[number];

export interface LearningTrace {
  event: LearningTraceEvent;
  occurredAt: string;
  tenantId?: string;
  learnerId?: string;
  correlationId?: string;
  durationMs?: number;
  payload: Record<string, unknown>;
}

export function buildLearningTrace(
  event: LearningTraceEvent,
  payload: Record<string, unknown> = {},
  meta: { tenantId?: string; learnerId?: string; correlationId?: string; durationMs?: number } = {},
): LearningTrace {
  return {
    event,
    occurredAt: new Date().toISOString(),
    tenantId: meta.tenantId,
    learnerId: meta.learnerId,
    correlationId: meta.correlationId,
    durationMs: meta.durationMs,
    payload: redactForLogging(payload),
  };
}
