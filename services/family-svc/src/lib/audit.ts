/**
 * family-svc audit helper. Wraps `appendAudit` for every parent
 * mutation (interests added/removed, observations submitted,
 * collaboration invites). Audit-write failures log a warn-level
 * breadcrumb and do NOT break the parent dashboard flow.
 */
import type { FastifyRequest } from "fastify";
import { auditEvents, appendAudit } from "@aivo/db";

export type FamilyAuditEventType =
  | "PARENT_INTEREST_ADDED"
  | "PARENT_INTEREST_REMOVED"
  | "PARENT_OBSERVATION_SUBMITTED"
  | "THERAPY_SESSION_RECORDED"
  | "TEACHER_INSIGHT_SUBMITTED"
  | "CAREGIVER_INVITED"
  | "CAREGIVER_ACCEPTED"
  | "CAREGIVER_REVOKED";

export interface EmitFamilyAuditInput {
  db: any;
  request: FastifyRequest;
  eventType: FamilyAuditEventType;
  tenantId: string | null;
  learnerId: string;
  resourceId?: string | null;
  details?: Record<string, unknown>;
}

export async function emitFamilyAudit(input: EmitFamilyAuditInput): Promise<void> {
  const auth = (input.request as any).auth ?? {};
  try {
    await appendAudit(input.db, "audit_events", auditEvents, {
      tenantId: input.tenantId || null,
      userId: typeof auth.sub === "string" && auth.sub !== "service" ? auth.sub : null,
      onBehalfOfId: null,
      eventType: input.eventType,
      resourceType: "family",
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
      "family-svc audit append failed",
    );
  }
}
