/**
 * learning-svc audit helper.
 *
 * Wraps `appendAudit` so every LessonRun lifecycle event lands in the
 * hash-chained `audit_events` table with consistent shape. Callers pass
 * the event type and a `details` payload; this helper fills in the
 * tenant + caller + resource columns and never throws — audit must not
 * break the lesson flow.
 */
import type { FastifyRequest } from "fastify";
import { auditEvents, appendAudit } from "@aivo/db";

export type LessonRunAuditEventType =
  | "LESSON_RUN_STARTED"
  | "LESSON_RUN_COMPLETED"
  | "LESSON_RUN_ABANDONED"
  | "THERAPY_SESSION_LOGGED"
  | "GRADEBOOK_ENTRY_UPDATED";

export interface EmitLessonAuditInput {
  db: any;
  request: FastifyRequest;
  eventType: LessonRunAuditEventType;
  tenantId: string;
  learnerId: string;
  sessionId?: string | null;
  details?: Record<string, unknown>;
}

export async function emitLessonAudit(input: EmitLessonAuditInput): Promise<void> {
  const auth = (input.request as any).auth ?? {};
  try {
    await appendAudit(input.db, "audit_events", auditEvents, {
      tenantId: input.tenantId || null,
      userId: typeof auth.sub === "string" && auth.sub !== "service" ? auth.sub : null,
      onBehalfOfId: null,
      eventType: input.eventType,
      resourceType: "lesson_session",
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
    // Audit failure must not break the lesson flow. The observability
    // plugin captures the request id; we log a warn-level breadcrumb.
    input.request.log.warn(
      { eventType: input.eventType, sessionId: input.sessionId, err: (err as Error).message },
      "learning-svc audit append failed",
    );
  }
}
