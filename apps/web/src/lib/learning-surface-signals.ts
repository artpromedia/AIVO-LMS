/**
 * Builds backend-shaped `SurfaceSignal` records from the raw
 * `SurfaceResponse` + `SurfaceTelemetryEvent[]` produced by
 * `@aivo/learner-surfaces`. Used by both the discovery completion
 * payload and the lesson completion payload so the assessment
 * service can run process-aware analysis without the client having
 * to re-implement the math.
 */
import type { SurfaceResponse, SurfaceTelemetryEvent } from "@aivo/learner-surfaces";

export interface LearnerSurfaceSignal {
  activityId: string;
  domain: string;
  interaction: string;
  finalAnswer?: string | number | boolean;
  correct?: boolean;
  latencyMs?: number;
  inkStrokeCount?: number;
  erasureCount?: number;
  hintCount?: number;
  toolChangeCount?: number;
  abandoned?: boolean;
  audioReplayCount?: number;
  instructionReplayCount?: number;
  dragPrecision?: number;
  scratchpadUsed?: boolean;
}

export interface BuildSignalInput {
  activityId: string;
  domain: string;
  interaction: string;
  response: SurfaceResponse;
  events: SurfaceTelemetryEvent[];
  correct?: boolean;
  startedAt?: number;
  submittedAt?: number;
  abandoned?: boolean;
}

export function buildSurfaceSignal(input: BuildSignalInput): LearnerSurfaceSignal {
  const { events, response } = input;
  const inkStrokeCount = response.inkStrokes?.length ?? 0;
  const erasureCount =
    (response.inkStrokes ?? []).filter((s) => s.tool === "eraser").length +
    events.filter((e) => e.type === "ink_undo" || e.type === "ink_clear").length;
  const toolChangeCount = events.filter((e) => e.type === "tool_changed").length;
  const hintCount = events.filter(
    (e) => e.type === "tool_changed" && e.payload?.tool === "hint",
  ).length;

  const startedAt = input.startedAt ?? (Date.parse(events[0]?.occurredAt ?? "") || undefined);
  const submittedAt =
    input.submittedAt ?? (Date.parse(events[events.length - 1]?.occurredAt ?? "") || undefined);
  const latencyMs =
    startedAt && submittedAt && submittedAt > startedAt ? submittedAt - startedAt : undefined;

  return {
    activityId: input.activityId,
    domain: input.domain,
    interaction: input.interaction,
    finalAnswer: response.answer ?? response.selectedChoiceId,
    correct: input.correct,
    latencyMs,
    inkStrokeCount,
    erasureCount,
    hintCount,
    toolChangeCount,
    abandoned: input.abandoned,
    scratchpadUsed: inkStrokeCount > 0,
  };
}
