import type { FastifyInstance } from "fastify";
import {
  registerGovernanceSubscriber,
  type GovernanceSubjectRequest,
  type EraseResult,
  type ExportResult,
} from "@aivo/enterprise-core";
import { subscriptions, tutorSubscriptions, invoices } from "@aivo/db";
import { eq } from "drizzle-orm";

export function registerGovernanceRoutes(app: FastifyInstance, db: any): void {
  registerGovernanceSubscriber(app, {
    service: "billing-svc",

    async erase(req: GovernanceSubjectRequest): Promise<EraseResult> {
      if (!db) return { counts: {} };
      const uid = req.subjectId;

      const [subs, tutorSubs] = await Promise.all([
        db
          .delete(subscriptions)
          .where(eq(subscriptions.userId, uid))
          .returning({ id: subscriptions.id }),
        db
          .delete(tutorSubscriptions)
          .where(eq(tutorSubscriptions.userId, uid))
          .returning({ id: tutorSubscriptions.id }),
      ]);

      // invoices are keyed by tenantId only (no userId FK); export-only for billing records.
      return {
        counts: {
          subscriptions: subs.length,
          tutor_subscriptions: tutorSubs.length,
        },
      };
    },

    async export(req: GovernanceSubjectRequest): Promise<ExportResult> {
      if (!db) return { counts: {}, bundle: {} };
      const uid = req.subjectId;

      const [subs, tutorSubs] = await Promise.all([
        db.select().from(subscriptions).where(eq(subscriptions.userId, uid)),
        db.select().from(tutorSubscriptions).where(eq(tutorSubscriptions.userId, uid)),
      ]);

      // invoices are keyed by tenantId; include tenant-scoped invoices when tenantId is provided.
      let inv: unknown[] = [];
      if (req.tenantId) {
        inv = await db.select().from(invoices).where(eq(invoices.tenantId, req.tenantId));
      }

      return {
        counts: {
          subscriptions: subs.length,
          tutor_subscriptions: tutorSubs.length,
          invoices: inv.length,
        },
        bundle: { subscriptions: subs, tutor_subscriptions: tutorSubs, invoices: inv },
      };
    },
  });
}
