/**
 * Centralised structured telemetry helpers for the discovery
 * adventure. These wrap a single object shape so the calling code at
 * the chapter / activity level doesn't have to remember field names
 * for each event type.
 */

export type DiscoveryEventName =
  | "baseline_generation_started"
  | "baseline_generation_succeeded"
  | "baseline_generation_failed"
  | "baseline_generation_fallback_used"
  | "baseline_activity_rejected"
  | "learner_surface_started"
  | "learner_surface_submitted"
  | "scratchpad_used";

export interface DiscoveryEvent {
  name: DiscoveryEventName;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export function emitDiscoveryEvent(
  name: DiscoveryEventName,
  payload: Record<string, unknown> = {},
): DiscoveryEvent {
  const event: DiscoveryEvent = {
    name,
    occurredAt: new Date().toISOString(),
    payload,
  };

  // Browser console logging is intentional: parents/admins can inspect
  // baseline generation in the dev console without server access. We
  // strip raw IEP / free-text content at the call-site, never here.
  if (typeof window !== "undefined") {
    console.info(`[discovery] ${name}`, payload);
  }

  return event;
}
