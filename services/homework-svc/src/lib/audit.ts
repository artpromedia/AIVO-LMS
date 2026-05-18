/**
 * homework-svc audit emitter.
 *
 * homework-svc holds sessions in memory rather than the relational DB,
 * so we emit audit events via HTTP POST to audit-svc (which owns the
 * hash chain) instead of writing directly to `audit_events`.
 *
 * Best-effort and tightly time-budgeted: audit-svc unreachable or slow
 * must NEVER block the learner-facing homework flow. Failures log a
 * warn breadcrumb and return.
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

export type HomeworkAuditEventType =
  | "HOMEWORK_SESSION_STARTED"
  | "HOMEWORK_STEP_SUBMITTED"
  | "HOMEWORK_HINT_REQUESTED"
  | "HOMEWORK_SESSION_COMPLETED"
  | "HOMEWORK_UPLOAD_RECEIVED";

export interface EmitHomeworkAuditInput {
  request: FastifyRequest;
  eventType: HomeworkAuditEventType;
  tenantId: string | null;
  learnerId: string;
  resourceId?: string | null;
  details?: Record<string, unknown>;
}

export async function emitHomeworkAudit(input: EmitHomeworkAuditInput): Promise<void> {
  const auth = (input.request as any).auth ?? {};
  const payload = {
    action: input.eventType,
    resourceType: "homework_session",
    resourceId: input.resourceId ?? null,
    tenantId: input.tenantId,
    actorUserId: typeof auth.sub === "string" && auth.sub !== "service" ? auth.sub : null,
    actorRole: auth.role ?? "service",
    details: {
      learnerId: input.learnerId,
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
        "homework-svc audit emit non-2xx",
      );
    }
  } catch (err) {
    input.request.log.warn(
      {
        eventType: input.eventType,
        learnerId: input.learnerId,
        err: (err as Error).message,
      },
      "homework-svc audit emit failed",
    );
  } finally {
    clearTimeout(timer);
  }
}
