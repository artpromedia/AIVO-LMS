export const LEARNING_EVENT_TYPES = [
  "problem_session_started",
  "problem_session_completed",
  "surface_rendered",
  "scratchpad_stroke_added",
  "scratchpad_erased",
  "surface_snapshot_saved",
  "answer_attempted",
  "hint_requested",
  "tutor_intervention",
  "frustration_signal_detected",
  "self_regulation_break_suggested",
  "profile_recommendation_candidate_detected",
  "profile_recommendation_created",
] as const;

export type LearningEventType = (typeof LEARNING_EVENT_TYPES)[number];

export interface LearningEventBase<TPayload = Record<string, unknown>> {
  eventId: string;
  eventType: LearningEventType;
  tenantId: string;
  learnerId: string;
  occurredAt: string;
  sourceService: string;
  correlationId: string;
  payload: TPayload;
}

export function isLearningEventType(value: string): value is LearningEventType {
  return (LEARNING_EVENT_TYPES as readonly string[]).includes(value);
}
