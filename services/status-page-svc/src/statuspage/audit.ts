/**
 * Audit emitter for status-page management (Sprint 8).
 * Incident declarations + updates, maintenance schedule changes, and
 * component changes land in the hash-chained audit_events table.
 * Failures never block the response.
 */
import type { FastifyRequest } from "fastify";

const AUDIT_SVC_URL = (process.env.AUDIT_SVC_URL ?? "http://localhost:3050").replace(/\/+$/, "");
const AUDIT_TIMEOUT_MS = Number(process.env.AUDIT_TIMEOUT_MS ?? 1500);

function serviceToken(): string {
  const configured = process.env.INTERNAL_SERVICE_TOKEN ?? "";
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return "\0PROD_TOKEN_NOT_CONFIGURED\0";
  return "aivo-internal-dev-token";
}

export type StatusAuditAction =
  | "STATUS_INCIDENT_DECLARED"
  | "STATUS_INCIDENT_UPDATED"
  | "STATUS_MAINTENANCE_SCHEDULED"
  | "STATUS_MAINTENANCE_UPDATED"
  | "STATUS_COMPONENT_CHANGED"
  | "STATUS_SLO_CHANGED";

export async function emitStatusAudit(
  req: FastifyRequest,
  action: StatusAuditAction,
  resourceId: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  const payload = {
    action,
    resourceType: "status_page",
    resourceId,
    tenantId: null,
    actorUserId: (req as any).actorRole ? null : null,
    actorRole: (req as any).actorRole ?? "service",
    details,
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUDIT_TIMEOUT_MS);
  try {
    const res = await fetch(`${AUDIT_SVC_URL}/api/audit-events`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-service-token": serviceToken() },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) req.log.warn({ action, status: res.status }, "status audit non-2xx");
  } catch (err) {
    req.log.warn({ action, err: (err as Error).message }, "status audit failed");
  } finally {
    clearTimeout(timer);
  }
}
