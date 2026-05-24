/**
 * Sprint 0 — Guardrails & Observability.
 *
 * Centralized handling for downstream service calls in learning-svc.
 * Replaces the previous swallowing `catch {}` blocks that silently
 * returned synthetic learner-facing content when an upstream brain /
 * subject-brain / problem-session / responsible-ai call failed.
 *
 * Each downstream failure now:
 *   1. Emits a structured pino log with
 *      { service, endpoint, statusCode, correlationId, learnerId }.
 *   2. Increments the Prometheus counter
 *      `learning_svc_downstream_failures_total{service,endpoint}`.
 *   3. Reports the failed subsystem to the caller via a
 *      `DegradationTracker`, so the route can return a typed
 *      `DegradedResponse` with `degraded: true` and
 *      `degradedSubsystems: string[]` instead of a fabricated payload.
 *
 * The feature flag `LEARNING_SVC_FAIL_OPEN` controls whether the
 * lesson flow continues with best-effort defaults when a critical
 * subsystem (BRAIN_SVC) is unavailable. Default is `false` in
 * production and `true` in development.
 */

import { createCounter, createLogger } from "@aivo/observability";

const logger = createLogger("learning-svc:downstream");

/**
 * Names of downstream services tracked by this module. Kept narrow on
 * purpose so the Prometheus label cardinality stays bounded.
 */
export type DownstreamService =
  | "brain-svc"
  | "subject-brain-svc"
  | "problem-session-svc"
  | "responsible-ai-svc";

export const downstreamFailures = createCounter(
  "learning_svc_downstream_failures_total",
  ["service", "endpoint"],
);

/**
 * Resolve `LEARNING_SVC_FAIL_OPEN`. Default behaviour:
 *   - production → false (fail closed; surface degraded response)
 *   - non-prod   → true  (fall back to best-effort defaults)
 */
export function failOpen(): boolean {
  const raw = process.env.LEARNING_SVC_FAIL_OPEN;
  if (raw == null || raw === "") {
    return process.env.NODE_ENV !== "production";
  }
  const v = String(raw).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export interface DowntreamCallContext {
  correlationId?: string;
  learnerId?: string;
  /** Optional tracker the route handler created for this request. */
  tracker?: DegradationTracker;
}

export interface DowntreamFailureInput extends DowntreamCallContext {
  service: DownstreamService;
  endpoint: string;
  statusCode?: number;
  err?: unknown;
}

/**
 * Log + count a downstream failure and (if a tracker is attached)
 * record the subsystem so the route can surface it to the client.
 */
export function reportDownstreamFailure(input: DowntreamFailureInput): void {
  const { service, endpoint, statusCode, correlationId, learnerId, err, tracker } = input;
  downstreamFailures.increment(1, { service, endpoint });
  const errMessage =
    err instanceof Error ? err.message : err != null ? String(err) : undefined;
  logger.error(
    {
      service,
      endpoint,
      statusCode,
      correlationId,
      learnerId,
      err: errMessage,
    },
    `downstream call failed: ${service} ${endpoint}`,
  );
  tracker?.add(service);
}

/**
 * Per-request collector for the names of subsystems that failed.
 * Routes create one of these, pass it into the downstream helpers,
 * then call `.snapshot()` to embed the list in the response payload.
 */
export class DegradationTracker {
  private readonly subsystems = new Set<DownstreamService>();

  add(service: DownstreamService): void {
    this.subsystems.add(service);
  }

  has(service: DownstreamService): boolean {
    return this.subsystems.has(service);
  }

  isDegraded(): boolean {
    return this.subsystems.size > 0;
  }

  snapshot(): DownstreamService[] {
    return Array.from(this.subsystems).sort();
  }
}

/**
 * Typed shape returned by routes when a critical subsystem failed and
 * the service is configured to fail closed.
 */
export interface DegradedResponse {
  degraded: true;
  degradedSubsystems: DownstreamService[];
  error: string;
}

/** Convenience helper for building a 503 fail-closed body. */
export function buildDegradedResponse(
  tracker: DegradationTracker,
  error: string,
): DegradedResponse {
  return {
    degraded: true,
    degradedSubsystems: tracker.snapshot(),
    error,
  };
}
