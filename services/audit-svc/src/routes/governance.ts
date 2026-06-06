import type { FastifyInstance } from "fastify";
import {
  registerGovernanceSubscriber,
  type GovernanceHandlers,
  type GovernanceSubjectRequest,
  type EraseResult,
  type ExportResult,
} from "@aivo/enterprise-core";
import { auditEvents } from "@aivo/db";
import { eq, or, sql } from "drizzle-orm";

interface StoredHashLink {
  prevHash: string | null;
  hash: string | null;
}

/**
 * Verify the stored forward links without recomputing payload hashes. DSAR
 * anonymization intentionally changes actor PII, but must never rewrite the
 * immutable link fields that make deletion/reordering detectable.
 */
export function verifyStoredHashLinks(rows: readonly StoredHashLink[]): boolean {
  for (let index = 1; index < rows.length; index += 1) {
    if ((rows[index]?.prevHash ?? "") !== (rows[index - 1]?.hash ?? "")) return false;
  }
  return true;
}

export function createGovernanceHandlers(db: any): GovernanceHandlers {
  return {
    service: "audit-svc",

    async erase(req: GovernanceSubjectRequest): Promise<EraseResult> {
      if (!db) return { counts: {}, anonymizedCounts: {} };
      const uid = req.subjectId;

      // Rows where this subject appears as actor (userId or onBehalfOfId).
      // We report the affected rows as anonymizedCounts rather than counts
      // because we do NOT delete — the append-only hash chain must be kept.
      const rows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditEvents)
        .where(or(eq(auditEvents.userId, uid), eq(auditEvents.onBehalfOfId, uid)));
      const n = rows[0]?.count ?? 0;

      // ADR 0034 §5: anonymize actor PII in place. The UPDATE nulls the
      // actor identity / network columns WITHOUT touching prevHash / hash,
      // so the forward chain (each row's prevHash still equals the prior
      // row's hash) remains intact and verifiable. Backward content
      // re-verification of these specific rows will now show NULL actors —
      // this is the expected, documented DSAR outcome (see the DSAR
      // runbook), not chain corruption.
      if (n > 0) {
        await db
          .update(auditEvents)
          .set({ userId: null, onBehalfOfId: null, ipAddress: null, userAgent: null })
          .where(or(eq(auditEvents.userId, uid), eq(auditEvents.onBehalfOfId, uid)));
      }

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
  };
}

// audit-svc is special: the hash chain MUST be preserved. We must NOT delete
// rows. Instead we anonymize actor PII columns in place while leaving the
// stored prevHash/hash links intact. governance-chain.test.ts exercises the
// real erase handler and proves those links survive the write.
export function registerGovernanceRoutes(app: FastifyInstance, db: any): void {
  registerGovernanceSubscriber(app, createGovernanceHandlers(db));
}
