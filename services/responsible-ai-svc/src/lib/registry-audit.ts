/**
 * Generic audit emitter for Responsible AI Console mutations (Sprint 7).
 *
 * Registry mutations, policy changes, eval runs, incident state changes
 * and opt-out toggles all land in the hash-chained audit_events table via
 * audit-svc. Like the safety evaluator emitter, audit-write failures never
 * block the response — they log a warn breadcrumb and return.
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

export type RegistryAuditAction =
  | "RAI_MODEL_REGISTERED"
  | "RAI_MODEL_UPDATED"
  | "RAI_MODEL_RETIRED"
  | "RAI_POLICY_UPDATED"
  | "RAI_EVAL_RUN"
  | "RAI_INCIDENT_CREATED"
  | "RAI_INCIDENT_UPDATED"
  | "RAI_OPTOUT_CREATED"
  | "RAI_OPTOUT_REMOVED"
  | "AI_CALL_BLOCKED";

export async function emitRegistryAudit(
  request: FastifyRequest,
  action: RegistryAuditAction,
  resourceId: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  const ctx = request.enterpriseContext;
  const payload = {
    action,
    resourceType: "responsible_ai_registry",
    resourceId,
    tenantId: ctx?.tenant?.tenantId ?? null,
    actorUserId: ctx?.actorId ?? null,
    actorRole: ctx?.actorRole ?? "service",
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
    if (!res.ok) {
      request.log.warn({ action, resourceId, status: res.status }, "rai registry audit non-2xx");
    }
  } catch (err) {
    request.log.warn({ action, resourceId, err: (err as Error).message }, "rai registry audit failed");
  } finally {
    clearTimeout(timer);
  }
}
