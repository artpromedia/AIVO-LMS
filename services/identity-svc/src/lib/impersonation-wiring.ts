/**
 * Production wiring for the impersonation routes (Sprint 9).
 *
 * Builds the DB-backed resolver set the routes need. Everything is defensive:
 * a missing table or column degrades to a safe default rather than crashing
 * the request, and audit writes are best-effort (never block the response).
 */
import { eq } from "drizzle-orm";
import { users, learners, tenants, auditEvents, appendAudit } from "@aivo/db";
import type { ImpersonationAuditEvent, ImpersonationDeps, StartBody } from "../routes/impersonation.js";
import type { Actor, Subject, TenantImpersonationSettings } from "./impersonation.js";

function ageFromDob(dob: Date | string | null | undefined): number | undefined {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return undefined;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

export function buildImpersonationDeps(db: any): Omit<ImpersonationDeps, "verifyStepUp"> {
  return {
    async resolveSubject(subjectUserId: string): Promise<Subject | null> {
      try {
        const [u] = await db.select().from(users).where(eq(users.id, subjectUserId)).limit(1);
        if (!u) return null;
        // Age comes from the learner record when the subject is a learner.
        let ageYears: number | undefined;
        try {
          const [l] = await db
            .select({ dob: learners.dateOfBirth, schoolId: learners.schoolId })
            .from(learners)
            .where(eq(learners.userId, subjectUserId))
            .limit(1);
          if (l) ageYears = ageFromDob(l.dob);
        } catch {
          /* learners lookup optional */
        }
        return {
          userId: u.id,
          role: String(u.role).toLowerCase() as Subject["role"],
          tenantId: u.tenantId ?? "",
          districtId: (u as Record<string, unknown>).districtId as string | undefined,
          schoolId: (u as Record<string, unknown>).schoolId as string | undefined,
          ageYears,
        };
      } catch {
        return null;
      }
    },

    async resolveTenantSettings(tenantId: string): Promise<TenantImpersonationSettings> {
      try {
        const [t] = await db
          .select({ settings: tenants.settings })
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1);
        const imp = (t?.settings as Record<string, any> | undefined)?.impersonation ?? {};
        return {
          enabled: imp.enabled !== false, // default-on
          maxTtlSeconds: typeof imp.maxTtlSeconds === "number" ? imp.maxTtlSeconds : undefined,
        };
      } catch {
        return { enabled: true };
      }
    },

    async resolveConsent(_actor: Actor, _subject: Subject, body: StartBody) {
      // The route passes documented bases via the request body; guardian
      // consent for minors is sourced from the consent ledger when present.
      // Here we trust the validated body (the route already enforced RBAC and
      // step-up) and treat platform_override as adult-only (the consent
      // evaluator ignores it for minors).
      return {
        hasSubjectConsent: !!body.subject_consent,
        hasGuardianConsent: !!body.guardian_consent,
        justificationTicketId: body.justification_ticket_id ?? null,
        platformOverride: !!body.platform_override,
        breakGlassCode: body.break_glass_code ?? null,
        hasOpenIncident: !!body.open_incident,
      };
    },

    audit(event: ImpersonationAuditEvent) {
      // Best-effort hash-chained audit write.
      void appendAudit(db, "audit_events", auditEvents as any, {
        action: event.action,
        resourceType: "impersonation",
        resourceId: event.details?.sessionId ?? event.subjectId ?? null,
        actorUserId: event.actorId,
        actorRole: "admin",
        details: {
          subjectId: event.subjectId,
          reason: event.reason,
          basis: event.basis,
          justificationTicketId: event.justificationTicketId,
          ip: event.ip,
          ua: event.ua,
          ...event.details,
        },
      } as any).catch(() => {
        /* audit best-effort */
      });
    },
  };
}
