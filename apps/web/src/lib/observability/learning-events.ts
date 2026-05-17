/**
 * Web-side structured event emitter for the learning runtime. Events
 * are intentionally low-cardinality and never carry raw learner
 * free-text or IEP content — only IDs, counts, status codes, and
 * timing.
 */

export type LearningEventName =
  | "baseline_generation_started"
  | "baseline_generation_succeeded"
  | "baseline_generation_failed"
  | "baseline_generation_fallback_used"
  | "baseline_activity_rejected"
  | "learner_surface_started"
  | "learner_surface_submitted"
  | "scratchpad_used"
  | "geometry_surface_rendered"
  | "stageplan_generation_started"
  | "stageplan_generation_failed"
  | "stageplan_loaded"
  | "demo_lesson_used";

export interface LearningEvent {
  name: LearningEventName;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export function emitLearningEvent(name: LearningEventName, payload: Record<string, unknown> = {}): LearningEvent {
  const event: LearningEvent = { name, occurredAt: new Date().toISOString(), payload };
  if (typeof window !== "undefined") {
    console.info(`[learning] ${name}`, payload);
  }
  return event;
}

export const PERFORMANCE_BUDGETS = {
  baselineGenerationMs: 15000,
  stageplanGenerationMs: 15000,
  surfaceRenderMs: 1000,
} as const;

export function checkBudget(name: keyof typeof PERFORMANCE_BUDGETS, durationMs: number): boolean {
  const budget = PERFORMANCE_BUDGETS[name];
  if (durationMs <= budget) return true;
  if (typeof window !== "undefined") {
    console.warn(`[learning] perf budget exceeded: ${name} = ${durationMs}ms (budget ${budget}ms)`);
  }
  return false;
}
