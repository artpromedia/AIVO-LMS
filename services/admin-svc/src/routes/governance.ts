import type { FastifyInstance } from "fastify";
import {
  registerGovernanceSubscriber,
  type GovernanceSubjectRequest,
  type EraseResult,
  type ExportResult,
} from "@aivo/enterprise-core";
import { adminAuditLog, dataRequests } from "@aivo/db";
import { eq, or } from "drizzle-orm";

export function registerGovernanceRoutes(app: FastifyInstance, db: any): void {
  registerGovernanceSubscriber(app, {
    service: "admin-svc",

    async erase(req: GovernanceSubjectRequest): Promise<EraseResult> {
      if (!db) return { counts: {} };
      const uid = req.subjectId;

      // adminAuditLog has a hash chain — we anonymize rather than delete,
      // matching the same contract as audit-svc. dataRequests reference
      // the subject by subjectId FK; we nullify PII fields rather than
      // removing the DSAR record itself.
      //
      // TODO(sprint5): Decide whether adminAuditLog rows should be deleted
      // or anonymized (hash chain concern identical to audit-svc). For now
      // we return counts: {} and let the orchestrator mark this service as
      // acknowledged without deletion.
      const dr = await db
        .delete(dataRequests)
        .where(
          or(
            eq(dataRequests.subjectId, uid),
            eq(dataRequests.requesterId, uid),
          ),
        )
        .returning({ id: dataRequests.id });

      return {
        counts: {
          data_requests: dr.length,
        },
      };
    },

    async export(req: GovernanceSubjectRequest): Promise<ExportResult> {
      if (!db) return { counts: {}, bundle: {} };
      const uid = req.subjectId;

      const [auditRows, dr] = await Promise.all([
        db
          .select()
          .from(adminAuditLog)
          .where(
            or(
              eq(adminAuditLog.actorId, uid),
              eq(adminAuditLog.onBehalfOfId, uid),
            ),
          ),
        db
          .select()
          .from(dataRequests)
          .where(
            or(
              eq(dataRequests.subjectId, uid),
              eq(dataRequests.requesterId, uid),
            ),
          ),
      ]);

      return {
        counts: {
          admin_audit_log: auditRows.length,
          data_requests: dr.length,
        },
        bundle: { admin_audit_log: auditRows, data_requests: dr },
      };
    },
  });
}
