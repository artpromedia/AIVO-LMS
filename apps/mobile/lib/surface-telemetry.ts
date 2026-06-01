/**
 * Sprint 3 (subject/tutor UX) — mobile activity-surface telemetry.
 *
 * Mirrors the web `SurfaceTelemetryEvent` contract
 * (`packages/learner-surfaces/src/telemetry/surface-events.ts`) so the two
 * clients report the same surface events. The mobile renderer fires
 * `surface_started` when it shows a real interactive surface and
 * `unsupported_surface` when it has to fall back — previously a fallback was a
 * silent scratchpad downgrade with no signal at all.
 *
 * Until a dedicated mobile analytics client lands, the default sink writes a
 * structured log line (the "structured log line is the bus" pattern used
 * elsewhere in the platform). Hosts can replace the sink with
 * `setSurfaceTelemetrySink` to forward events to a real pipeline.
 */
export type MobileSurfaceTelemetryType =
  | "surface_started"
  | "surface_submitted"
  | "unsupported_surface";

export interface MobileSurfaceTelemetryEvent {
  /** Mobile surface kind (e.g. "geometry_workspace", "art_canvas"). */
  surfaceKind: string;
  type: MobileSurfaceTelemetryType;
  occurredAt: string;
  payload?: Record<string, unknown>;
}

export type SurfaceTelemetrySink = (event: MobileSurfaceTelemetryEvent) => void;

const defaultSink: SurfaceTelemetrySink = (event) => {
  // eslint-disable-next-line no-console
  console.warn(`[surface-telemetry] ${event.type} kind=${event.surfaceKind}`, event.payload ?? {});
};

let sink: SurfaceTelemetrySink = defaultSink;

/** Replace the telemetry sink (e.g. wire to a real analytics pipeline). */
export function setSurfaceTelemetrySink(next: SurfaceTelemetrySink | null): void {
  sink = next ?? defaultSink;
}

/** Emit a surface telemetry event through the active sink. */
export function emitSurfaceTelemetry(
  surfaceKind: string,
  type: MobileSurfaceTelemetryType,
  payload?: Record<string, unknown>,
): MobileSurfaceTelemetryEvent {
  const event: MobileSurfaceTelemetryEvent = {
    surfaceKind,
    type,
    occurredAt: new Date().toISOString(),
    payload,
  };
  try {
    sink(event);
  } catch {
    // Telemetry must never break the lesson.
  }
  return event;
}
