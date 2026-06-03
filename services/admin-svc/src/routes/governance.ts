import type { FastifyInstance } from "fastify";
import {
  registerGovernanceSubscriber,
  type GovernanceSubjectRequest,
  type EraseResult,
  type ExportResult,
} from "@aivo/enterprise-core";
import { adminAuditLog, dataRequests } from "@aivo/db";
import { eq, or, sql } from "drizzle-orm";

/** Sentinel for the NOT NULL actor_email column once a subject is erased. */
const REDACTED_EMAIL = "redacted@dsar.invalid";

export function registerGovernanceRoutes(app: FastifyInstance, db: any): void {
  registerGovernanceSubscriber(app, {
    service: "admin-svc",

    async erase(req: GovernanceSubjectRequest): Promise<EraseResult> {
      if (!db) return { counts: {}, anonymizedCounts: {} };
      const uid = req.subjectId;

      // dataRequests are operational DSAR records that reference the subject
      // by FK — they carry no hash chain, so we delete them outright.
      const dr = await db
        .delete(dataRequests)
        .where(or(eq(dataRequests.subjectId, uid), eq(dataRequests.requesterId, uid)))
        .returning({ id: dataRequests.id });

      // adminAuditLog is hash-chained and append-only (same contract as
      // audit-svc, ADR 0034 §5): anonymize actor PII in place, never delete.
      // prev_hash / hash are left untouched so the forward chain stays
      // verifiable. Two targeted updates so we only scrub PII that actually
      // belongs to the subject:
      //   - rows where the subject is the actor → scrub their email/ip/ua
      //     (actor_email is NOT NULL, so a redaction sentinel is used);
      //   - rows where the subject was the impersonated party → drop the
      //     on_behalf_of link, leaving the acting admin's own fields intact.
      const affected = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(adminAuditLog)
        .where(or(eq(adminAuditLog.actorId, uid), eq(adminAuditLog.onBehalfOfId, uid)));
      const auditCount = affected[0]?.count ?? 0;

      if (auditCount > 0) {
        await db
          .update(adminAuditLog)
          .set({ actorEmail: REDACTED_EMAIL, ipAddress: null, userAgent: null })
          .where(eq(adminAuditLog.actorId, uid));
        await db
          .update(adminAuditLog)
          .set({ onBehalfOfId: null })
          .where(eq(adminAuditLog.onBehalfOfId, uid));
      }

      return {
        counts: { data_requests: dr.length },
        anonymizedCounts: { admin_audit_log: auditCount },
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
