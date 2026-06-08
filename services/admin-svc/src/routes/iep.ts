/**
 * IEP oversight (read-only).
 *
 * Reads the real Postgres IEP tables (@aivo/db): `iep_evaluations` (the SPED
 * evaluation workflow) and `iep_profiles` (active IEPs + annual review dates).
 * No new tables, no mock — the IEP authoring/evaluation flow owns the writes;
 * this surface is admin oversight only.
 *
 *   GET /api/admin-svc/iep/evaluations   — pipeline counts + recent (role-scoped)
 *   GET /api/admin-svc/iep/profiles       — lifecycle counts + review-due list
 *
 * Platform admins see every tenant; district admins are scoped to their own.
 */
import { FastifyInstance } from "fastify";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { iepEvaluations, iepProfiles } from "@aivo/db";
import { verifyJWT } from "@aivo/security";

const IEP_ROLES = new Set(["PLATFORM_ADMIN", "DISTRICT_ADMIN"]);

async function requireIepAdmin(req: any, reply: any): Promise<boolean> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    reply.status(401).send({ error: "Missing authorization header" });
    return false;
  }
  try {
    const payload = await verifyJWT<any>(auth.slice(7));
    if (!IEP_ROLES.has(payload.role as string)) {
      reply.status(403).send({ error: "IEP admin access required" });
      return false;
    }
    req.user = payload;
    return true;
  } catch {
    reply.status(401).send({ error: "Invalid token" });
    return false;
  }
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function iso(v: any): string | null {
  return v?.toISOString?.() ?? (v ? String(v) : null);
}

function countsFrom(rows: Array<{ key: unknown; n: unknown }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) out[String(row.key)] = num(row.n);
  return out;
}

export function registerIepRoutes(app: FastifyInstance, db: any): void {
  app.get(
    "/api/admin-svc/iep/evaluations",
    { schema: { tags: ["iep"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requireIepAdmin(req, reply))) return;
      const actor = (req as any).user;
      // Platform admins see all tenants; district admins only their own.
      const scope =
        actor.role === "PLATFORM_ADMIN"
          ? undefined
          : eq(iepEvaluations.tenantId, actor.tenantId);

      const countRows = await db
        .select({ key: iepEvaluations.status, n: sql<number>`count(*)` })
        .from(iepEvaluations)
        .where(scope)
        .groupBy(iepEvaluations.status);

      const rows = await db
        .select({
          id: iepEvaluations.id,
          learnerId: iepEvaluations.learnerId,
          tenantId: iepEvaluations.tenantId,
          status: iepEvaluations.status,
          referralReason: iepEvaluations.referralReason,
          decisionEligible: iepEvaluations.decisionEligible,
          submittedAt: iepEvaluations.submittedAt,
          decidedAt: iepEvaluations.decidedAt,
          createdAt: iepEvaluations.createdAt,
          updatedAt: iepEvaluations.updatedAt,
        })
        .from(iepEvaluations)
        .where(scope)
        .orderBy(desc(iepEvaluations.updatedAt))
        .limit(200);

      return {
        counts: countsFrom(countRows),
        evaluations: rows.map((r: any) => ({
          id: r.id,
          learnerId: r.learnerId,
          tenantId: r.tenantId ?? null,
          status: r.status,
          referralReason: r.referralReason ?? null,
          decisionEligible: r.decisionEligible ?? null,
          submittedAt: iso(r.submittedAt),
          decidedAt: iso(r.decidedAt),
          createdAt: iso(r.createdAt),
          updatedAt: iso(r.updatedAt),
        })),
      };
    },
  );

  app.get(
    "/api/admin-svc/iep/profiles",
    { schema: { tags: ["iep"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      // Profiles are not tenant-columned; restrict the cross-tenant view to
      // platform admins.
      if (!(await requireIepAdmin(req, reply))) return;
      const actor = (req as any).user;
      if (actor.role !== "PLATFORM_ADMIN") {
        return reply.status(403).send({ error: "Platform admin access required" });
      }

      const countRows = await db
        .select({ key: iepProfiles.lifecycleState, n: sql<number>`count(*)` })
        .from(iepProfiles)
        .groupBy(iepProfiles.lifecycleState);

      const now = new Date();
      const dueRows = await db
        .select({
          id: iepProfiles.id,
          learnerId: iepProfiles.learnerId,
          gradeLevel: iepProfiles.gradeLevel,
          placement: iepProfiles.placement,
          lifecycleState: iepProfiles.lifecycleState,
          reviewDate: iepProfiles.reviewDate,
          revisionCounter: iepProfiles.revisionCounter,
        })
        .from(iepProfiles)
        .where(and(lt(iepProfiles.reviewDate, now)))
        .orderBy(iepProfiles.reviewDate)
        .limit(200);

      return {
        counts: countsFrom(countRows),
        reviewDue: dueRows.length,
        profiles: dueRows.map((r: any) => ({
          id: r.id,
          learnerId: r.learnerId,
          gradeLevel: r.gradeLevel ?? null,
          placement: r.placement ?? null,
          lifecycleState: r.lifecycleState,
          reviewDate: iso(r.reviewDate),
          revisionCounter: num(r.revisionCounter),
        })),
      };
    },
  );
}
