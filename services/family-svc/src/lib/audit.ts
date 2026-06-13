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
  | "CAREGIVER_OBSERVATION_EDITED"
  | "CAREGIVER_SUGGESTION_SUBMITTED"
  | "THERAPY_SESSION_RECORDED"
  | "TEACHER_INSIGHT_SUBMITTED"
  | "CAREGIVER_INVITED"
  | "CAREGIVER_ACCEPTED"
  | "CAREGIVER_REVOKED"
  | "PARENT_CONSENT_CHANGED"
  | "PARENT_INVITED"
  | "TEAM_INVITE_RESENT"
  | "TEAM_INVITE_REVOKED"
  | "TEAM_MEMBER_REMOVED"
  | "TEAM_INVITE_ACCEPTED"
  | "LANGUAGE_PROFILE_UPDATED"
  | "PARENT_PREFERENCES_UPDATED"
  | "RECOMMENDATION_DECIDED"
  | "SPEECH_BUDDY_CONSENT_CHANGED"
  | "TRANSITION_PLAN_UPDATED"
  | "FAMILY_GOAL_DECIDED"
  // Sprint C-12 (ADR 0042) — FERPA cross-role read of a child's profile.
  | "CHILD_PROFILE_DISCLOSED";

export interface EmitFamilyAuditInput {
  db: any;
  request: FastifyRequest;
  eventType: FamilyAuditEventType;
  tenantId: string | null;
  learnerId: string;
  resourceId?: string | null;
  details?: Record<string, unknown>;
  /**
   * Explicit actor override. `emitFamilyAudit` normally reads
   * `(request as any).auth`, which family-svc routes do NOT set (they resolve
   * claims as a return value from `authenticateRequest`). Pass the reader here
   * so the disclosure row records the real `userId` + role rather than null.
   */
  actor?: { userId: string | null; role: string | null };
}

export async function emitFamilyAudit(input: EmitFamilyAuditInput): Promise<void> {
  const auth = (input.request as any).auth ?? {};
  const userId =
    input.actor !== undefined
      ? input.actor.userId
      : typeof auth.sub === "string" && auth.sub !== "service"
        ? auth.sub
        : null;
  const callerRole = input.actor !== undefined ? input.actor.role : (auth.role ?? null);
  try {
    await appendAudit(input.db, "audit_events", auditEvents, {
      tenantId: input.tenantId || null,
      userId,
      onBehalfOfId: null,
      eventType: input.eventType,
      resourceType: "family",
      resourceId: input.resourceId ?? null,
      details: {
        learnerId: input.learnerId,
        callerRole,
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

/**
 * Sprint C-12 (ADR 0042) — record a FERPA cross-role read of a child's profile.
 *
 * Writes a `CHILD_PROFILE_DISCLOSED` event to the hash-chained, append-only
 * `audit_events` table (ADR 0032 chain) carrying the disclosure tuple
 * `(tenantId, learnerId, readerUserId, readerRole, surface, dataClass,
 * timestamp)`. `learnerId` is on the row + in details so the compliance query
 * endpoint can scope per-learner; the timestamp is the row's `createdAt`.
 * Best-effort: a degraded audit path must never break a scoped read.
 */
export async function emitChildProfileDisclosure(input: {
  db: any;
  request: FastifyRequest;
  tenantId: string | null;
  learnerId: string;
  readerUserId: string | null;
  readerRole: string | null;
  surface: string;
  dataClass: string;
}): Promise<void> {
  await emitFamilyAudit({
    db: input.db,
    request: input.request,
    eventType: "CHILD_PROFILE_DISCLOSED",
    tenantId: input.tenantId,
    learnerId: input.learnerId,
    resourceId: input.learnerId,
    actor: { userId: input.readerUserId, role: input.readerRole },
    details: {
      readerUserId: input.readerUserId,
      readerRole: input.readerRole,
      surface: input.surface,
      dataClass: input.dataClass,
    },
  });
}
