import type { RequestContext } from "./request-context.js";

export interface AuditContext {
  actorId?: string;
  actorRole?: string;
  tenantId?: string;
  learnerId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  reason?: string;
  correlationId?: string;
}

export interface BuildAuditContextInput {
  request?: RequestContext;
  action: string;
  resourceType: string;
  resourceId?: string;
  learnerId?: string;
  reason?: string;
}

export function buildAuditContext(input: BuildAuditContextInput): AuditContext {
  const { request, action, resourceType, resourceId, learnerId, reason } = input;
  return {
    actorId: request?.actorId,
    actorRole: request?.actorRole,
    tenantId: request?.tenant?.tenantId,
    learnerId: learnerId ?? request?.tenant?.learnerId,
    action,
    resourceType,
    resourceId,
    reason,
    correlationId: request?.correlationId ?? request?.requestId,
  };
}
