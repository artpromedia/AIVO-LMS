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
import { createCounter, createLogger } from "./index.js";

export type SubjectBrainCallStatus = "ok" | "miss_no_subject" | "miss_error";

const logger = createLogger("observability.subject-brain-metrics");

const subjectBrainCalls = createCounter("subject_brain_calls_total", ["subject", "status"]);

export function recordSubjectBrainCall(
  subject: string,
  status: SubjectBrainCallStatus,
  meta?: { learnerId?: string; correlationId?: string; reason?: string },
): void {
  subjectBrainCalls.increment(1, { subject, status });
  if (status !== "ok") {
    logger.warn("subject_brain_call_miss", {
      subject,
      status,
      learnerId: meta?.learnerId,
      correlationId: meta?.correlationId,
      reason: meta?.reason,
    });
  }
}
