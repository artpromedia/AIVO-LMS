/**
 * comms-svc audit helper. Wraps `appendAudit` for every notification
 * lifecycle event (send queued, send succeeded, send failed,
 * preference updated). Audit-write failures log a warn-level
 * breadcrumb and do NOT break the notification dispatch path.
 *
 * Comms events are privacy-sensitive: which learner received which
 * communication, on which channel, is part of the consent record.
 */
import type { FastifyRequest } from "fastify";
import { auditEvents, appendAudit } from "@aivo/db";

export type CommsAuditEventType =
  | "NOTIFICATION_QUEUED"
  | "NOTIFICATION_SENT"
  | "NOTIFICATION_FAILED"
  | "NOTIFICATION_SKIPPED"
  | "NOTIFICATION_PREFERENCE_UPDATED"
  | "PARENT_DIGEST_DISPATCHED";

export interface EmitCommsAuditInput {
  db: any;
  request: FastifyRequest;
  eventType: CommsAuditEventType;
  tenantId: string | null;
  learnerId?: string | null;
  userId?: string | null;
  resourceId?: string | null;
  details?: Record<string, unknown>;
}

export async function emitCommsAudit(input: EmitCommsAuditInput): Promise<void> {
  const auth = (input.request as any).auth ?? {};
  try {
    await appendAudit(input.db, "audit_events", auditEvents, {
      tenantId: input.tenantId || null,
      userId:
        input.userId ?? (typeof auth.sub === "string" && auth.sub !== "service" ? auth.sub : null),
      onBehalfOfId: null,
      eventType: input.eventType,
      resourceType: "notification",
      resourceId: input.resourceId ?? null,
      details: {
        learnerId: input.learnerId ?? null,
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
        resourceId: input.resourceId,
        err: (err as Error).message,
      },
      "comms-svc audit append failed",
    );
  }
}
