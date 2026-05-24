export type SurfaceTelemetryEventType =
  | "surface_started"
  | "surface_submitted"
  | "complete"
  | "ink_started"
  | "ink_completed"
  | "ink_undo"
  | "ink_clear"
  | "answer_changed"
  | "code-run"
  | "code-test-pass"
  | "code-test-fail"
  | "tool_changed"
  | "geometry_action"
  | "unsupported_surface"
  | "play"
  | "pause"
  | "seek"
  | "complete"
  | "caption-on"
  | "caption-off"
  | "captions_missing";

export interface SurfaceTelemetryEvent {
  id: string;
  surfaceId: string;
  type: SurfaceTelemetryEventType;
  occurredAt: string;
  payload?: Record<string, unknown>;
}

function createEventId(surfaceId: string, type: SurfaceTelemetryEventType): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${surfaceId}-${type}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export function createSurfaceEvent(
  surfaceId: string,
  type: SurfaceTelemetryEventType,
  payload?: Record<string, unknown>,
): SurfaceTelemetryEvent {
  return {
    id: createEventId(surfaceId, type),
    surfaceId,
    type,
    occurredAt: new Date().toISOString(),
    payload,
  };
}
