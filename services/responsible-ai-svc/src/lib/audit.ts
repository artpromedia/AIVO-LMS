/**
 * responsible-ai-svc audit emitter.
 *
 * Posts to audit-svc via HTTP whenever the safety evaluator rejects or
 * escalates AI output, so every block decision lands in the hash-
 * chained `audit_events` table. responsible-ai-svc has no DB connection
 * of its own.
 *
 * Audit-write failures NEVER block the evaluator response — they log
 * a warn breadcrumb and return.
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

export type ResponsibleAiAuditEventType =
  | "RESPONSIBLE_AI_BLOCKED"
  | "RESPONSIBLE_AI_REVISED"
  | "RESPONSIBLE_AI_ESCALATED";

export interface EmitResponsibleAiAuditInput {
  request: FastifyRequest;
  eventType: ResponsibleAiAuditEventType;
  learnerId: string;
  contextType: string;
  severity: string;
  violationCodes: string[];
  details?: Record<string, unknown>;
}

export async function emitResponsibleAiAudit(input: EmitResponsibleAiAuditInput): Promise<void> {
  const auth = (input.request as any).auth ?? {};
  const payload = {
    action: input.eventType,
    resourceType: "responsible_ai_evaluation",
    resourceId: null,
    tenantId: (auth.tenantId as string | undefined) ?? null,
    actorUserId: typeof auth.sub === "string" && auth.sub !== "service" ? auth.sub : null,
    actorRole: auth.role ?? "service",
    details: {
      learnerId: input.learnerId,
      contextType: input.contextType,
      severity: input.severity,
      violationCodes: input.violationCodes,
      ...input.details,
    },
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUDIT_TIMEOUT_MS);
  try {
    const res = await fetch(`${AUDIT_SVC_URL}/api/audit-events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-token": serviceToken(),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      input.request.log.warn(
        {
          eventType: input.eventType,
          learnerId: input.learnerId,
          status: res.status,
        },
        "responsible-ai-svc audit emit non-2xx",
      );
    }
  } catch (err) {
    input.request.log.warn(
      {
        eventType: input.eventType,
        learnerId: input.learnerId,
        err: (err as Error).message,
      },
      "responsible-ai-svc audit emit failed",
    );
  } finally {
    clearTimeout(timer);
  }
}
