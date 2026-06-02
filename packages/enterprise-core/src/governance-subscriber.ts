/**
 * Governance subscriber contract (Sprint 5 — data governance / DSAR).
 *
 * Every data-owning service mounts `registerGovernanceSubscriber(app, …)`
 * to expose two internal endpoints the data-governance-svc orchestrator
 * fans out to:
 *
 *   POST /__governance/erase   — purge or anonymize all rows for a subject.
 *   POST /__governance/export  — return a structured JSON bundle for a subject.
 *
 * Both are internal-only (guarded by `x-internal-key`) and reply with the
 * affected record counts so the orchestrator can compute a reconciliation
 * checksum. See ADR 0034.
 */
import type { FastifyInstance } from "fastify";

export interface GovernanceSubjectRequest {
  subjectId: string;
  subjectType: string;
  tenantId: string | null;
  dsarId: string | null;
}

export interface EraseResult {
  /** table/collection -> rows deleted. */
  counts: Record<string, number>;
  /** table/collection -> rows anonymized (kept, but PII scrubbed). */
  anonymizedCounts?: Record<string, number>;
}

export interface ExportResult {
  /** table/collection -> rows included in the bundle. */
  counts: Record<string, number>;
  /** Structured, JSON-serializable payload for the subject. */
  bundle: unknown;
}

export interface GovernanceHandlers {
  /** Logical service name, echoed back to the orchestrator. */
  service: string;
  erase: (req: GovernanceSubjectRequest) => Promise<EraseResult> | EraseResult;
  export: (req: GovernanceSubjectRequest) => Promise<ExportResult> | ExportResult;
  /**
   * Optional internal-key override. Defaults to INTERNAL_SERVICE_KEY (or a
   * dev fallback outside production), matching the orchestrator dispatcher.
   */
  internalKey?: string;
}

function resolveInternalKey(explicit?: string): string {
  if (explicit) return explicit;
  return (
    process.env.INTERNAL_SERVICE_KEY ||
    (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key")
  );
}

function normalizeSubject(body: unknown): GovernanceSubjectRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.subjectId !== "string" || b.subjectId.length === 0) return null;
  return {
    subjectId: b.subjectId,
    subjectType: typeof b.subjectType === "string" ? b.subjectType : "learner",
    tenantId: typeof b.tenantId === "string" ? b.tenantId : null,
    dsarId: typeof b.dsarId === "string" ? b.dsarId : null,
  };
}

export function registerGovernanceSubscriber(
  app: FastifyInstance,
  handlers: GovernanceHandlers,
): void {
  const internalKey = resolveInternalKey(handlers.internalKey);

  const guard = (request: { headers: Record<string, unknown> }): boolean => {
    // In production a key is mandatory; outside production the dev default
    // is accepted so local fan-out works without extra config.
    const provided = request.headers["x-internal-key"];
    if (!internalKey) return process.env.NODE_ENV !== "production";
    return provided === internalKey;
  };

  app.post("/__governance/erase", async (request, reply) => {
    if (!guard(request as any)) return reply.code(401).send({ error: "internal key required" });
    const subject = normalizeSubject(request.body);
    if (!subject) return reply.code(400).send({ error: "subjectId is required" });
    try {
      const result = await handlers.erase(subject);
      return {
        service: handlers.service,
        counts: result.counts ?? {},
        anonymizedCounts: result.anonymizedCounts ?? {},
      };
    } catch (err) {
      request.log?.error?.({ err }, "governance erase failed");
      return reply.code(500).send({ service: handlers.service, error: "erase failed" });
    }
  });

  app.post("/__governance/export", async (request, reply) => {
    if (!guard(request as any)) return reply.code(401).send({ error: "internal key required" });
    const subject = normalizeSubject(request.body);
    if (!subject) return reply.code(400).send({ error: "subjectId is required" });
    try {
      const result = await handlers.export(subject);
      return {
        service: handlers.service,
        counts: result.counts ?? {},
        bundle: result.bundle ?? {},
      };
    } catch (err) {
      request.log?.error?.({ err }, "governance export failed");
      return reply.code(500).send({ service: handlers.service, error: "export failed" });
    }
  });
}
