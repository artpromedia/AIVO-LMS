/**
 * Sprint C-12 (ADR 0042) — the FERPA disclosure query surface.
 *
 * The cross-stack canonical disclosure store is the hash-chained, append-only
 * `audit_events` table (ADR 0032). Cross-role reads of a child's brain profile
 * are recorded there as `CHILD_PROFILE_DISCLOSED` events by family-svc
 * (teacher/caregiver/therapist views, `collaboration.ts`) and brain-svc
 * (scoped reads, via audit-svc). This endpoint is the compliance/admin read
 * over that store: per-learner, time-bounded.
 *
 *   GET /api/family/compliance/disclosures/:learnerId?from=&to=
 *
 * Authorization: PLATFORM_ADMIN / DISTRICT_ADMIN / SCHOOL_ADMIN only — a
 * teacher, caregiver, therapist, or parent cannot enumerate who has read a
 * child's profile. Tenant-scoped: an admin sees only their own tenant's rows
 * (PLATFORM_ADMIN may see across tenants). `from`/`to` are inclusive ISO-8601
 * bounds on the event timestamp; both optional.
 */
import { FastifyInstance } from "fastify";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { auditEvents } from "@aivo/db";
import { authenticateRequest } from "../auth.js";

/** Roles permitted to query the disclosure log. */
const COMPLIANCE_ROLES = new Set(["PLATFORM_ADMIN", "DISTRICT_ADMIN", "SCHOOL_ADMIN"]);

export async function registerComplianceRoutes(app: FastifyInstance) {
  const db = (app as unknown as { db: ReturnType<typeof import("@aivo/db").createDb> }).db;

  app.get(
    "/api/family/compliance/disclosures/:learnerId",
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      if (!COMPLIANCE_ROLES.has(claims.role)) {
        return reply
          .code(403)
          .send({ error: "Access denied — compliance or admin role required" });
      }

      const { learnerId } = request.params as { learnerId: string };
      const { from, to } = (request.query as { from?: string; to?: string }) || {};

      const conditions = [
        eq(auditEvents.eventType, "CHILD_PROFILE_DISCLOSED"),
        eq(auditEvents.resourceId, learnerId),
      ];
      // PLATFORM_ADMIN sees across tenants; scoped admins see only their tenant.
      if (claims.role !== "PLATFORM_ADMIN" && claims.tenantId) {
        conditions.push(eq(auditEvents.tenantId, claims.tenantId));
      }
      if (from) {
        const fromDate = new Date(from);
        if (!Number.isNaN(fromDate.getTime())) {
          conditions.push(gte(auditEvents.createdAt, fromDate));
        }
      }
      if (to) {
        const toDate = new Date(to);
        if (!Number.isNaN(toDate.getTime())) {
          conditions.push(lte(auditEvents.createdAt, toDate));
        }
      }

      const rows = await db
        .select()
        .from(auditEvents)
        .where(and(...conditions))
        .orderBy(desc(auditEvents.createdAt));

      return {
        learnerId,
        count: rows.length,
        disclosures: rows.map((r) => {
          const details = (r.details ?? {}) as Record<string, unknown>;
          return {
            id: r.id,
            tenantId: r.tenantId,
            learnerId,
            readerUserId: (details.readerUserId as string | null) ?? r.userId,
            readerRole: (details.readerRole as string | null) ?? null,
            surface: (details.surface as string | null) ?? null,
            dataClass: (details.dataClass as string | null) ?? null,
            disclosedAt: r.createdAt,
          };
        }),
      };
    },
  );
}
