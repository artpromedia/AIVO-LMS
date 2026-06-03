/**
 * Per-request impersonation audit emitter (Sprint 9).
 *
 * The enterprise auth hook invokes this for every request issued under an
 * impersonation token (request, write_allowed, write_blocked, expired). It
 * posts a hash-chained audit event to audit-svc. Fire-and-forget: failures
 * log only, never block the request.
 */
import type { ImpersonatedRequestAuditEvent } from "@aivo/enterprise-core";

const AUDIT_SVC_URL = (process.env.AUDIT_SVC_URL ?? "http://localhost:3050").replace(/\/+$/, "");

function serviceToken(): string {
  return process.env.INTERNAL_SERVICE_TOKEN ?? "aivo-internal-dev-token";
}

export function emitImpersonationRequestAudit(event: ImpersonatedRequestAuditEvent): void {
  const payload = {
    action: event.action,
    resourceType: "impersonation_request",
    resourceId: event.sessionId ?? null,
    tenantId: null,
    actorUserId: event.actorId ?? null,
    actorRole: "service",
    details: {
      subjectId: event.subjectId,
      reason: event.reason,
      method: event.method,
      path: event.path,
      ip: event.ip,
      userAgent: event.userAgent,
      sourceService: "responsible-ai-svc",
    },
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  fetch(`${AUDIT_SVC_URL}/api/audit-events`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-service-token": serviceToken() },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
    .catch(() => {
      /* best-effort */
    })
    .finally(() => clearTimeout(timer));
}
