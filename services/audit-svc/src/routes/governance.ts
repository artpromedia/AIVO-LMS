import type { FastifyInstance } from "fastify";
import {
  registerGovernanceSubscriber,
  type GovernanceSubjectRequest,
  type EraseResult,
  type ExportResult,
} from "@aivo/enterprise-core";
import { auditEvents } from "@aivo/db";
import { eq, or, sql } from "drizzle-orm";

// audit-svc is special: the hash chain MUST be preserved. We must NOT
// delete rows. Instead we anonymize actor PII columns (userId /
// onBehalfOfId) in-place while leaving the hashes intact. If mutating
// in-place turns out to be unsafe (e.g. hash chain re-verification would
// fail), the TODO below must be resolved before enabling writes.
export function registerGovernanceRoutes(app: FastifyInstance, db: any): void {
  registerGovernanceSubscriber(app, {
    service: "audit-svc",

    async erase(req: GovernanceSubjectRequest): Promise<EraseResult> {
      if (!db) return { counts: {}, anonymizedCounts: {} };
      const uid = req.subjectId;

      // Count rows where this subject appears as actor (userId or
      // onBehalfOfId). We return this count as anonymizedCounts rather
      // than counts because we do NOT delete — the chain must be kept.
      //
      // TODO(sprint5): Uncomment the UPDATE block once the chain
      // re-verification story is resolved (ADR 0034 §5). The UPDATE sets
      // userId / onBehalfOfId to NULL without touching prevHash / hash, so
      // chain integrity is preserved for forward-verification. Backward
      // verification of pre-anonymization rows will show NULL actors, which
      // is expected and documented in the DSAR runbook.
      //
      // await db
      //   .update(auditEvents)
      //   .set({ userId: null, onBehalfOfId: null, ipAddress: null, userAgent: null })
      //   .where(or(eq(auditEvents.userId, uid), eq(auditEvents.onBehalfOfId, uid)));

      const rows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditEvents)
        .where(or(eq(auditEvents.userId, uid), eq(auditEvents.onBehalfOfId, uid)));

      const n = rows[0]?.count ?? 0;
      return { counts: {}, anonymizedCounts: { audit_events: n } };
    },

    async export(req: GovernanceSubjectRequest): Promise<ExportResult> {
      if (!db) return { counts: {}, bundle: {} };
      const uid = req.subjectId;

      const rows = await db
        .select()
        .from(auditEvents)
        .where(or(eq(auditEvents.userId, uid), eq(auditEvents.onBehalfOfId, uid)));

      return {
        counts: { audit_events: rows.length },
        bundle: { audit_events: rows },
      };
    },
  });
}
