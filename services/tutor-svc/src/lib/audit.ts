/**
 * tutor-svc audit helper.
 *
 * Every tutor-runtime mutation (session start, AI message generation,
 * homework submission) emits a hash-chained row into `audit_events`.
 * Audit-write failures must NEVER break the learner-facing flow — they
 * log a warn-level breadcrumb and the request continues.
 *
 * Tutor events are responsible-AI critical: regulators and parent
 * dashboards trace AI-to-learner output back to the audit row.
 */
import type { FastifyRequest } from "fastify";
import { auditEvents, appendAudit } from "@aivo/db";

export type TutorAuditEventType =
  | "TUTOR_SESSION_STARTED"
  | "TUTOR_MESSAGE_GENERATED"
  | "TUTOR_HOMEWORK_SUBMITTED"
  | "TUTOR_HOMEWORK_HINT_REQUESTED"
  | "TUTOR_SAFETY_INTERVENTION"
  | "TUTOR_EF_PLAN_CREATED"
  | "TUTOR_EF_STEP_COMPLETED"
  | "TUTOR_AGENT_SESSION_OPENED";

export interface EmitTutorAuditInput {
  db: any;
  request: FastifyRequest;
  eventType: TutorAuditEventType;
  tenantId: string | null;
  learnerId: string;
  sessionId?: string | null;
  details?: Record<string, unknown>;
}

export async function emitTutorAudit(input: EmitTutorAuditInput): Promise<void> {
  const auth = (input.request as any).auth ?? {};
  try {
    await appendAudit(input.db, "audit_events", auditEvents, {
      tenantId: input.tenantId || null,
      userId: typeof auth.sub === "string" && auth.sub !== "service" ? auth.sub : null,
      onBehalfOfId: null,
      eventType: input.eventType,
      resourceType: "tutor_session",
      resourceId: input.sessionId ?? null,
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
        sessionId: input.sessionId,
        err: (err as Error).message,
      },
      "tutor-svc audit append failed",
    );
  }
}
