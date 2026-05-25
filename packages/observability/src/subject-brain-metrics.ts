/**
 * Subject-brain call metrics (Sprint C — completion plan).
 *
 * Lightweight counter + structured log helper for tracking how often
 * the `subject-brain-svc` enrichment is invoked, succeeds, or returns
 * undefined while the `advancedContentGenerators` flag is on. The
 * counter is exported via the existing observability Prometheus
 * pipeline (`exportMetrics`).
 *
 * The key invariant: when the flag is on, an undefined response is a
 * SIGNAL — either subject-brain-svc is down, returned a non-2xx, or
 * the subject is not mapped. Every undefined-while-on emits a warn
 * log so on-call sees the failure pattern instead of it being
 * silently swallowed.
 */
import { createCounter, createLogger, type Logger } from "./index.js";

export type SubjectBrainCallStatus = "ok" | "miss_no_subject" | "miss_error";

// Lazy initialisation avoids a circular import edge case where `./index.js`
// re-exports this module and evaluates the top-level statements before
// `createLogger` / `createCounter` are themselves defined.
let _logger: Logger | undefined;
function logger(): Logger {
  return (_logger ??= createLogger("observability.subject-brain-metrics"));
}

let _subjectBrainCalls: ReturnType<typeof createCounter> | undefined;
function subjectBrainCalls(): ReturnType<typeof createCounter> {
  return (_subjectBrainCalls ??= createCounter("subject_brain_calls_total", ["subject", "status"]));
}

export function recordSubjectBrainCall(
  subject: string,
  status: SubjectBrainCallStatus,
  meta?: { learnerId?: string; correlationId?: string; reason?: string },
): void {
  subjectBrainCalls().increment(1, { subject, status });
  if (status !== "ok") {
    logger().warn("subject_brain_call_miss", {
      subject,
      status,
      learnerId: meta?.learnerId,
      correlationId: meta?.correlationId,
      reason: meta?.reason,
    });
  }
}
