/**
 * District overview read model — real, district-scoped aggregates for the
 * district dashboard (apps/web-admin/app/district). No mock reads: KPIs,
 * learners-by-school, the named pilot list, the 90-day learner-progress trend
 * (from the district_mastery_daily snapshot), recent activity, and the
 * rostering banner all come from district-tenant tables.
 */
import type { FastifyInstance } from "fastify";
import {
  districtActivityLog,
  districtAdminInvites,
  districtMasteryDaily,
  districtSettings,
  integrationConnections,
  learners,
  pilotProgramSchools,
  pilotPrograms,
  schools,
  securityControls,
  tenants,
} from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import { and, desc, eq, gte, isNull } from "drizzle-orm";

const TREND_WINDOW_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const ALLOWED_ROLES = new Set(["DISTRICT_ADMIN", "PLATFORM_ADMIN"]);

/** SIS connection states that count as "rostering connected". */
const CONNECTED_SIS_STATUSES = new Set(["authorized", "active", "syncing"]);

async function requireDistrictAdmin(req: any, reply: any, districtId: string) {
  const auth = req.headers.authorization as string | undefined;
  if (!auth?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "missing_bearer_token" });
    return null;
  }
  try {
    const payload = (await verifyJWT(auth.slice(7).trim())) as {
      sub: string;
      role: string;
      tenantId: string;
    };
    if (!ALLOWED_ROLES.has(payload.role)) {
      reply.code(403).send({ error: "forbidden", required_roles: [...ALLOWED_ROLES] });
      return null;
    }
    // Tenant ownership: a district admin may only read their own district.
    // Platform admins are intentionally allowed cross-tenant.
    if (payload.role === "DISTRICT_ADMIN" && payload.tenantId !== districtId) {
      reply.code(403).send({ error: "forbidden_cross_tenant" });
      return null;
    }
    return payload;
  } catch {
    reply.code(401).send({ error: "invalid_token" });
    return null;
  }
}

function complianceBand(score: number): string {
  if (score >= 95) return "Excellent";
  if (score >= 85) return "Good";
  if (score >= 70) return "Fair";
  return "Needs attention";
}

/** Human title + icon hint for a recent-activity row. */
function activityPresentation(action: string): { title: string; icon: string } {
  const map: Record<string, { title: string; icon: string }> = {
    "sis.sync.completed": { title: "SIS sync completed", icon: "sync" },
    "admin.invited": { title: "New admin invited", icon: "user" },
    "report.generated": { title: "District report generated", icon: "report" },
    "compliance.check.passed": { title: "Compliance check passed", icon: "shield" },
    "school.created": { title: "School added", icon: "school" },
    "branding.updated": { title: "Branding updated", icon: "report" },
  };
  if (map[action]) return map[action];
  const title = action
    .split(/[._]/)
    .join(" ")
    .replace(/^\w/, (c) => c.toUpperCase());
  return { title, icon: "default" };
}

export function registerDistrictOverviewRoutes(app: FastifyInstance, db: any) {
  app.get<{ Params: { districtId: string } }>(
    "/admin/districts/:districtId/overview",
    async (req, reply) => {
      const tid = req.params.districtId;
      const actor = await requireDistrictAdmin(req, reply, tid);
      if (!actor) return;
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
      const trendSince = new Date(now.getTime() - (TREND_WINDOW_DAYS - 1) * DAY_MS);
      trendSince.setUTCHours(0, 0, 0, 0);
      const trendSinceKey = trendSince.toISOString().slice(0, 10);

      const [
        tenantRow,
        schoolRows,
        learnerRows,
        programRows,
        programSchoolRows,
        trendRows,
        activityRows,
        sisRows,
        inviteRows,
        controlRows,
        [settingsRow],
      ] = await Promise.all([
        db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, tid)),
        db
          .select({ id: schools.id, name: schools.name, createdAt: schools.createdAt })
          .from(schools)
          .where(eq(schools.tenantId, tid)),
        db
          .select({ id: learners.id, schoolId: learners.schoolId, createdAt: learners.createdAt })
          .from(learners)
          .where(eq(learners.tenantId, tid)),
        db
          .select({
            id: pilotPrograms.id,
            name: pilotPrograms.name,
            status: pilotPrograms.status,
            leadSchoolId: pilotPrograms.leadSchoolId,
            enrolledLearners: pilotPrograms.enrolledLearners,
            createdAt: pilotPrograms.createdAt,
          })
          .from(pilotPrograms)
          .where(eq(pilotPrograms.tenantId, tid)),
        db
          .select({ programId: pilotProgramSchools.programId, schoolId: pilotProgramSchools.schoolId })
          .from(pilotProgramSchools)
          .innerJoin(pilotPrograms, eq(pilotProgramSchools.programId, pilotPrograms.id))
          .where(eq(pilotPrograms.tenantId, tid)),
        db
          .select({
            day: districtMasteryDaily.day,
            mastery: districtMasteryDaily.mastery,
            onTrack: districtMasteryDaily.onTrack,
            atRisk: districtMasteryDaily.atRisk,
            needsSupport: districtMasteryDaily.needsSupport,
          })
          .from(districtMasteryDaily)
          .where(and(eq(districtMasteryDaily.tenantId, tid), gte(districtMasteryDaily.day, trendSinceKey)))
          .orderBy(districtMasteryDaily.day),
        db
          .select({
            id: districtActivityLog.id,
            action: districtActivityLog.action,
            resourceType: districtActivityLog.resourceType,
            actorName: districtActivityLog.actorName,
            details: districtActivityLog.details,
            createdAt: districtActivityLog.createdAt,
          })
          .from(districtActivityLog)
          .where(eq(districtActivityLog.tenantId, tid))
          .orderBy(desc(districtActivityLog.createdAt))
          .limit(6),
        db
          .select({
            externalOrgId: integrationConnections.externalOrgId,
            status: integrationConnections.status,
          })
          .from(integrationConnections)
          .where(
            and(
              eq(integrationConnections.tenantId, tid),
              eq(integrationConnections.connectorType, "sis"),
            ),
          ),
        db
          .select({ id: districtAdminInvites.id })
          .from(districtAdminInvites)
          .where(and(eq(districtAdminInvites.tenantId, tid), isNull(districtAdminInvites.revokedAt))),
        db.select({ status: securityControls.status }).from(securityControls),
        db.select({ branding: districtSettings.branding }).from(districtSettings).where(eq(districtSettings.tenantId, tid)),
      ]);

      const schoolNameById = new Map<string, string>(
        (schoolRows as Array<{ id: string; name: string }>).map((s) => [s.id, s.name]),
      );

      // KPI deltas (rows created in the last 30 days).
      const schoolsDelta = (schoolRows as Array<{ createdAt: Date | string }>).filter(
        (s) => new Date(s.createdAt) >= thirtyDaysAgo,
      ).length;
      const learnersDelta = (learnerRows as Array<{ createdAt: Date | string }>).filter(
        (l) => new Date(l.createdAt) >= thirtyDaysAgo,
      ).length;

      // Learners grouped by school → top 5 + "Other (N schools)".
      const bySchool = new Map<string, number>();
      for (const l of learnerRows as Array<{ schoolId: string | null }>) {
        if (!l.schoolId) continue;
        bySchool.set(l.schoolId, (bySchool.get(l.schoolId) ?? 0) + 1);
      }
      const ranked = [...bySchool.entries()]
        .map(([id, learnersCount]) => ({ schoolId: id, name: schoolNameById.get(id) ?? "Unknown", learners: learnersCount }))
        .sort((a, b) => b.learners - a.learners);
      const top = ranked.slice(0, 5);
      const rest = ranked.slice(5);
      const slices = [...top];
      if (rest.length > 0) {
        slices.push({
          schoolId: "other",
          name: `Other (${rest.length} ${rest.length === 1 ? "school" : "schools"})`,
          learners: rest.reduce((sum, r) => sum + r.learners, 0),
        });
      }
      const learnersBySchoolTotal = slices.reduce((sum, s) => sum + s.learners, 0);

      // Pilot list: schools-per-program + lead-school label.
      const schoolsPerProgram = new Map<string, number>();
      for (const ps of programSchoolRows as Array<{ programId: string }>) {
        schoolsPerProgram.set(ps.programId, (schoolsPerProgram.get(ps.programId) ?? 0) + 1);
      }
      const statusRank: Record<string, number> = { active: 0, starting_soon: 1, paused: 2, completed: 3 };
      const pilotList = (
        programRows as Array<{
          id: string;
          name: string;
          status: string;
          leadSchoolId: string | null;
          enrolledLearners: number;
        }>
      )
        .map((p) => {
          const schoolCount = schoolsPerProgram.get(p.id) ?? 0;
          return {
            id: p.id,
            name: p.name,
            status: p.status,
            learners: Number(p.enrolledLearners ?? 0),
            leadSchool: p.leadSchoolId ? schoolNameById.get(p.leadSchoolId) ?? null : null,
            extraSchools: Math.max(0, schoolCount - 1),
          };
        })
        .sort((a, b) => (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9) || b.learners - a.learners);
      // "Active pilots" = every running pilot (active + starting soon + paused);
      // only completed pilots drop out of the count.
      const activePilots = (programRows as Array<{ status: string }>).filter(
        (p) => p.status !== "completed",
      ).length;
      const pilotsDelta = (programRows as Array<{ createdAt: Date | string }>).filter(
        (p) => new Date(p.createdAt) >= thirtyDaysAgo,
      ).length;

      // Compliance score from the control register (implemented=1, partial=0.5).
      const controls = controlRows as Array<{ status: string }>;
      let compliancePts = 0;
      for (const c of controls) {
        if (c.status === "implemented") compliancePts += 1;
        else if (c.status === "partial") compliancePts += 0.5;
      }
      const complianceScore = controls.length > 0 ? Math.round((compliancePts / controls.length) * 100) : 0;

      // Rostering: schools with an active SIS connection (externalOrgId = school id).
      const rosteredSchoolIds = new Set<string>();
      for (const c of sisRows as Array<{ externalOrgId: string | null; status: string }>) {
        if (c.externalOrgId && CONNECTED_SIS_STATUSES.has(c.status)) rosteredSchoolIds.add(c.externalOrgId);
      }
      const rosteredCount = [...rosteredSchoolIds].filter((id) => schoolNameById.has(id)).length;
      const schoolsNotRostered = Math.max(0, (schoolRows as unknown[]).length - rosteredCount);

      // Branding configured = any non-empty branding key.
      const branding = (settingsRow?.branding ?? {}) as Record<string, unknown>;
      const brandingDone = Object.values(branding).some((v) => v !== null && v !== undefined && v !== "");

      // Continuous zero-filled 90-day trend (UTC days).
      const trendByDay = new Map<string, { mastery: number; onTrack: number; atRisk: number; needsSupport: number }>();
      for (const r of trendRows as Array<{ day: string; mastery: number; onTrack: number; atRisk: number; needsSupport: number }>) {
        trendByDay.set(String(r.day).slice(0, 10), {
          mastery: Number(r.mastery),
          onTrack: Number(r.onTrack),
          atRisk: Number(r.atRisk),
          needsSupport: Number(r.needsSupport),
        });
      }
      const trend = Array.from({ length: TREND_WINDOW_DAYS }, (_, index) => {
        const key = new Date(trendSince.getTime() + index * DAY_MS).toISOString().slice(0, 10);
        const point = trendByDay.get(key);
        return {
          day: key,
          mastery: point?.mastery ?? 0,
          onTrack: point?.onTrack ?? 0,
          atRisk: point?.atRisk ?? 0,
          needsSupport: point?.needsSupport ?? 0,
        };
      });
      const hasTrend = trendRows.length > 0;

      const recentActivity = (
        activityRows as Array<{
          id: string;
          action: string;
          resourceType: string;
          actorName: string | null;
          details: Record<string, unknown> | null;
          createdAt: Date | string;
        }>
      ).map((r) => {
        const present = activityPresentation(r.action);
        const detailObj = (r.details ?? {}) as Record<string, unknown>;
        const subtitle =
          (typeof detailObj.subtitle === "string" && detailObj.subtitle) ||
          (typeof detailObj.schoolName === "string" && detailObj.schoolName) ||
          r.actorName ||
          null;
        return {
          id: r.id,
          title: present.title,
          icon: present.icon,
          subtitle,
          createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        };
      });

      return {
        districtId: tid,
        districtName: tenantRow[0]?.name ?? "District",
        generatedAt: now.toISOString(),
        windowDays: TREND_WINDOW_DAYS,
        schools: { total: (schoolRows as unknown[]).length, delta30d: schoolsDelta },
        learners: { total: (learnerRows as unknown[]).length, delta30d: learnersDelta },
        pilots: { activeTotal: activePilots, delta30d: pilotsDelta, list: pilotList },
        compliance: { score: complianceScore, band: complianceBand(complianceScore) },
        setupSignals: {
          schoolsCount: (schoolRows as unknown[]).length,
          adminsCount: (inviteRows as unknown[]).length,
          rosteringCount: rosteredCount,
          brandingDone,
        },
        trend,
        hasTrend,
        learnersBySchool: { total: learnersBySchoolTotal, slices },
        recentActivity,
        schoolsNotRostered,
      };
    },
  );
}
