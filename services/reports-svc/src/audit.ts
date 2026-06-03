/**
 * Best-effort audit emitter for reports-svc (Sprint 10).
 * Every run (with params), download, and schedule create/update/delete is
 * audited. Failures never block the response.
 */
const AUDIT_SVC_URL = (process.env.AUDIT_SVC_URL ?? "http://localhost:3050").replace(/\/+$/, "");

function serviceToken(): string {
  return process.env.INTERNAL_SERVICE_TOKEN ?? "aivo-internal-dev-token";
}

export type ReportAuditAction =
  | "report.run"
  | "report.download"
  | "report.schedule.created"
  | "report.schedule.deleted";

export interface ReportAuditInput {
  action: ReportAuditAction;
  actorId?: string;
  tenantId?: string | null;
  reportId?: string;
  resourceId?: string | null;
  details?: Record<string, unknown>;
}

export function emitReportAudit(input: ReportAuditInput): void {
  const payload = {
    action: input.action,
    resourceType: "report",
    resourceId: input.resourceId ?? input.reportId ?? null,
    tenantId: input.tenantId ?? null,
    actorUserId: input.actorId ?? null,
    actorRole: "admin",
    details: { reportId: input.reportId, ...input.details },
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  fetch(`${AUDIT_SVC_URL}/api/audit-events`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-service-token": serviceToken() },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
    .catch(() => {})
    .finally(() => clearTimeout(timer));
}
