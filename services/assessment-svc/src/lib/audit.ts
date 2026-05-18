/**
 * assessment-svc audit helper.
 *
 * Wraps `appendAudit` so every parent-assessment / IEP / baseline event
 * lands in the hash-chained `audit_events` table with consistent shape.
 * Audit-write failures must NEVER break the assessment flow — they log
 * a warn-level breadcrumb and return.
 *
 * Event types emitted here are consent-critical because parent
 * assessments and IEP documents touch protected learner information.
 * Reviewers should be able to trace every state change to a row in
 * `audit_events`.
 */
import type { FastifyRequest } from "fastify";
import { auditEvents, appendAudit } from "@aivo/db";

export type AssessmentAuditEventType =
  | "PARENT_ASSESSMENT_SUBMITTED"
  | "PARENT_ASSESSMENT_UPDATED"
  | "BASELINE_ASSESSMENT_STARTED"
  | "BASELINE_ASSESSMENT_COMPLETED"
  | "IEP_UPLOADED"
  | "IEP_EXTRACTED"
  | "IEP_SHARED_WITH_PARENT"
  | "IEP_ACCOMMODATION_UPDATED"
  | "TEACHER_ASSESSMENT_SUBMITTED"
  | "SENSORY_PROFILE_UPDATED";

export interface EmitAssessmentAuditInput {
  db: any;
  request: FastifyRequest;
  eventType: AssessmentAuditEventType;
  tenantId: string | null;
  learnerId: string;
  resourceId?: string | null;
  details?: Record<string, unknown>;
}

export async function emitAssessmentAudit(input: EmitAssessmentAuditInput): Promise<void> {
  const auth = (input.request as any).auth ?? {};
  try {
    await appendAudit(input.db, "audit_events", auditEvents, {
      tenantId: input.tenantId || null,
      userId: typeof auth.sub === "string" && auth.sub !== "service" ? auth.sub : null,
      onBehalfOfId: null,
      eventType: input.eventType,
      resourceType: "assessment",
      resourceId: input.resourceId ?? null,
      details: {
        learnerId: input.learnerId,
        callerRole: auth.role ?? null,
        ...input.details,
      },
      ipAddress:
        (input.request.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
        input.request.ip ||
        null,
      userAgent: input.request.headers["user-agent"] ?? null,
    });
  } catch (err) {
    input.request.log.warn(
      {
        eventType: input.eventType,
        learnerId: input.learnerId,
        err: (err as Error).message,
      },
      "assessment-svc audit append failed",
    );
  }
}
