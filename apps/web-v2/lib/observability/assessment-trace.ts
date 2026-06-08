/**
 * Structured-logging helper for the parent-assessment submit path.
 *
 * Sprint 0 instrumentation: emits three events around the durable
 * `submittedAt` upsert so the save bug is observable in production logs
 * without changing any control flow. No business logic lives here — it is
 * a thin wrapper over `@/lib/observability/logger`.
 *
 *   parent_assessment.submit.attempt   — before the durable write
 *   parent_assessment.submit.persisted — after the write returns a row
 *                                         with `submittedAt` set
 *   parent_assessment.submit.failed    — the write threw, or returned a
 *                                         record without `submittedAt`
 */
import { logger } from "@/lib/observability/logger";
import type { PersistenceMode } from "@/lib/db/persistence";

type AssessmentTraceFields = {
  learnerId: string;
  tenantId: string;
  mode: PersistenceMode;
  durationMs: number;
};

export function traceAssessmentSubmitAttempt(fields: {
  learnerId: string;
  tenantId: string;
  mode: PersistenceMode;
}): void {
  logger.info({ event: "parent_assessment.submit.attempt", ...fields });
}

export function traceAssessmentSubmitPersisted(fields: AssessmentTraceFields): void {
  logger.info({ event: "parent_assessment.submit.persisted", ...fields });
}

export function traceAssessmentSubmitFailed(
  fields: AssessmentTraceFields & { reason: string },
): void {
  logger.warn({ event: "parent_assessment.submit.failed", ...fields });
}
