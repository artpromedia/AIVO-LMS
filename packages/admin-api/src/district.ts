import "server-only";

import { adminGet } from "./client";
import type { SessionProfile } from "@aivo/admin-auth/types";

export type PilotStatus = "active" | "starting_soon" | "paused" | "completed";

export interface DistrictPilotRow {
  id: string;
  name: string;
  status: PilotStatus;
  learners: number;
  leadSchool: string | null;
  extraSchools: number;
}

export interface DistrictTrendPoint {
  day: string;
  mastery: number;
  onTrack: number;
  atRisk: number;
  needsSupport: number;
}

export interface DistrictSchoolSlice {
  schoolId: string;
  name: string;
  learners: number;
}

export interface DistrictActivityRow {
  id: string;
  title: string;
  icon: string;
  subtitle: string | null;
  createdAt: string;
}

/**
 * District overview read model (services/admin-svc/src/routes/district-overview.ts):
 * real district-scoped aggregates — KPIs with 30-day deltas, the 5-step setup
 * signals, the 90-day learner-progress trend, learners-by-school donut slices,
 * the named pilot list, recent activity, and the rostering banner count.
 */
export interface DistrictOverview {
  districtId: string;
  districtName: string;
  generatedAt: string;
  windowDays: number;
  schools: { total: number; delta30d: number };
  learners: { total: number; delta30d: number };
  pilots: { activeTotal: number; delta30d: number; list: DistrictPilotRow[] };
  compliance: { score: number; band: string };
  setupSignals: {
    schoolsCount: number;
    adminsCount: number;
    rosteringCount: number;
    brandingDone: boolean;
  };
  trend: DistrictTrendPoint[];
  hasTrend: boolean;
  learnersBySchool: { total: number; slices: DistrictSchoolSlice[] };
  recentActivity: DistrictActivityRow[];
  schoolsNotRostered: number;
}

export async function getDistrictOverview(
  session: Pick<SessionProfile, "role" | "tenantId">,
): Promise<DistrictOverview> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    `/admin/districts/${encodeURIComponent(session.tenantId)}/overview`,
  );
  const num = (value: unknown): number => (value === null || value === undefined ? 0 : Number(value));
  const str = (value: unknown): string => (value === null || value === undefined ? "" : String(value));
  const list = <T>(value: unknown, map: (row: Record<string, unknown>) => T): T[] =>
    Array.isArray(value) ? value.map((row) => map(row as Record<string, unknown>)) : [];

  const pilots = (payload.pilots ?? {}) as Record<string, unknown>;
  const schools = (payload.schools ?? {}) as Record<string, unknown>;
  const learners = (payload.learners ?? {}) as Record<string, unknown>;
  const compliance = (payload.compliance ?? {}) as Record<string, unknown>;
  const setup = (payload.setupSignals ?? {}) as Record<string, unknown>;
  const learnersBySchool = (payload.learnersBySchool ?? {}) as Record<string, unknown>;

  const pilotStatus = (value: unknown): PilotStatus => {
    const status = String(value ?? "active");
    return status === "active" || status === "starting_soon" || status === "paused" || status === "completed"
      ? status
      : "active";
  };

  return {
    districtId: str(payload.districtId),
    districtName: str(payload.districtName) || "District",
    generatedAt: str(payload.generatedAt),
    windowDays: num(payload.windowDays),
    schools: { total: num(schools.total), delta30d: num(schools.delta30d) },
    learners: { total: num(learners.total), delta30d: num(learners.delta30d) },
    pilots: {
      activeTotal: num(pilots.activeTotal),
      delta30d: num(pilots.delta30d),
      list: list(pilots.list, (row) => ({
        id: str(row.id),
        name: str(row.name),
        status: pilotStatus(row.status),
        learners: num(row.learners),
        leadSchool: row.leadSchool === null || row.leadSchool === undefined ? null : String(row.leadSchool),
        extraSchools: num(row.extraSchools),
      })),
    },
    compliance: { score: num(compliance.score), band: str(compliance.band) || "Needs attention" },
    setupSignals: {
      schoolsCount: num(setup.schoolsCount),
      adminsCount: num(setup.adminsCount),
      rosteringCount: num(setup.rosteringCount),
      brandingDone: Boolean(setup.brandingDone),
    },
    trend: list(payload.trend, (row) => ({
      day: str(row.day),
      mastery: num(row.mastery),
      onTrack: num(row.onTrack),
      atRisk: num(row.atRisk),
      needsSupport: num(row.needsSupport),
    })),
    hasTrend: Boolean(payload.hasTrend),
    learnersBySchool: {
      total: num(learnersBySchool.total),
      slices: list(learnersBySchool.slices, (row) => ({
        schoolId: str(row.schoolId),
        name: str(row.name),
        learners: num(row.learners),
      })),
    },
    recentActivity: list(payload.recentActivity, (row) => ({
      id: str(row.id),
      title: str(row.title),
      icon: str(row.icon) || "default",
      subtitle: row.subtitle === null || row.subtitle === undefined ? null : String(row.subtitle),
      createdAt: str(row.createdAt),
    })),
    schoolsNotRostered: num(payload.schoolsNotRostered),
  };
}
