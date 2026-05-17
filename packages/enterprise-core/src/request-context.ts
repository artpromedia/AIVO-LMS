import type { TenantContext, TenantRole } from "./tenant-context.js";

export interface RequestContext {
  requestId: string;
  actorId?: string;
  actorRole?: TenantRole;
  tenant?: TenantContext;
  sourceService?: string;
  correlationId?: string;
}

export interface CreateRequestContextInput {
  requestId?: string;
  actorId?: string;
  actorRole?: TenantRole;
  tenant?: TenantContext;
  sourceService?: string;
  correlationId?: string;
}

function generateRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  const random = Math.random().toString(36).slice(2, 10);
  return `req_${Date.now().toString(36)}_${random}`;
}

export function createRequestContext(input: CreateRequestContextInput = {}): RequestContext {
  const requestId = input.requestId ?? generateRequestId();
  return {
    requestId,
    actorId: input.actorId,
    actorRole: input.actorRole ?? input.tenant?.role,
    tenant: input.tenant,
    sourceService: input.sourceService,
    correlationId: input.correlationId ?? requestId,
  };
}
