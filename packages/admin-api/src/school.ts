import "server-only";

import { adminGet } from "./client";
import type { SessionProfile } from "@aivo/admin-auth/types";

export type SchoolClassStatus = "on_track" | "at_risk" | "needs_support" | "no_data";

/** One row of the active-classes table. All figures are real per-class aggregates. */
export interface SchoolClassRow {
  id: string;
  name: string;
  grade: string | null;
  teacherName: string | null;
  learners: number;
  /** Average gradebook mastery 0–100, or null when no gradebook data exists. */
  avgMastery: number | null;
  assignmentsDue: number;
  iepLearners: number;
  /** Lesson-session completion rate 0–100, or null when no sessions exist. */
  completionRate: number | null;
  status: SchoolClassStatus;
}

/**
 * School overview read model (services/admin-svc/src/routes/school-overview.ts):
 * real counts, lesson-session completion + daily term trend, active IEP goals,
 * support-type breakdown (by functioning level), per-class metrics, rostering
 * coverage, and recent roster-import jobs. For school admins the session
 * `tenantId` is the school id (same convention as the classroom routes).
 */
export interface SchoolOverview {
  schoolId: string;
  generatedAt: string;
  windowDays: number;
  counts: { learners: number; teachers: number; classes: number };
  /** Lesson-session completion rate (0–100) over the term window. */
  completionRate: number;
  activeIepGoals: number;
  /** Learners / classes created in the last 30 days (KPI deltas). */
  newLearners30d: number;
  newClasses30d: number;
  /** Learners grouped by functioning level (the truthful support-type breakdown). */
  supportBreakdown: Array<{ label: string; count: number }>;
  /** Daily completion rate (0–100) across the term window, oldest → newest. */
  termTrend: Array<{ day: string; completionRate: number }>;
  classes: SchoolClassRow[];
  rostering: { total: number; complete: number; unassigned: number };
  recentImports: Array<{
    jobId: string;
    status: string;
    total: number;
    errors: number;
    createdAt: string;
  }>;
}

export async function getSchoolOverview(
  session: Pick<SessionProfile, "role" | "tenantId">,
): Promise<SchoolOverview> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    `/admin/schools/${encodeURIComponent(session.tenantId)}/overview`,
  );
  const counts = (payload.counts ?? {}) as Record<string, unknown>;
  const rostering = (payload.rostering ?? {}) as Record<string, unknown>;
  const list = <T>(value: unknown, map: (row: Record<string, unknown>) => T): T[] =>
    Array.isArray(value) ? value.map((row) => map(row as Record<string, unknown>)) : [];
  const numOrNull = (value: unknown): number | null =>
    value === null || value === undefined ? null : Number(value);
  const classStatus = (value: unknown): SchoolClassStatus => {
    const status = String(value ?? "no_data");
    return status === "on_track" || status === "at_risk" || status === "needs_support"
      ? status
      : "no_data";
  };
  return {
    schoolId: String(payload.schoolId ?? session.tenantId),
    generatedAt: String(payload.generatedAt ?? new Date(0).toISOString()),
    windowDays: Number(payload.windowDays ?? 30),
    counts: {
      learners: Number(counts.learners ?? 0),
      teachers: Number(counts.teachers ?? 0),
      classes: Number(counts.classes ?? 0),
    },
    completionRate: Number(payload.completionRate ?? 0),
    activeIepGoals: Number(payload.activeIepGoals ?? 0),
    newLearners30d: Number(payload.newLearners30d ?? 0),
    newClasses30d: Number(payload.newClasses30d ?? 0),
    supportBreakdown: list(payload.supportBreakdown, (row) => ({
      label: String(row.label ?? "Unknown"),
      count: Number(row.count ?? 0),
    })),
    termTrend: list(payload.termTrend, (row) => ({
      day: String(row.day ?? ""),
      completionRate: Number(row.completionRate ?? 0),
    })),
    classes: list(payload.classes, (row) => ({
      id: String(row.id),
      name: String(row.name ?? row.id),
      grade: row.grade ? String(row.grade) : null,
      teacherName: row.teacherName ? String(row.teacherName) : null,
      learners: Number(row.learners ?? 0),
      avgMastery: numOrNull(row.avgMastery),
      assignmentsDue: Number(row.assignmentsDue ?? 0),
      iepLearners: Number(row.iepLearners ?? 0),
      completionRate: numOrNull(row.completionRate),
      status: classStatus(row.status),
    })),
    rostering: {
      total: Number(rostering.total ?? 0),
      complete: Number(rostering.complete ?? 0),
      unassigned: Number(rostering.unassigned ?? 0),
    },
    recentImports: list(payload.recentImports, (row) => ({
      jobId: String(row.jobId ?? ""),
      status: String(row.status ?? "pending"),
      total: Number(row.total ?? 0),
      errors: Number(row.errors ?? 0),
      createdAt: String(row.createdAt ?? new Date(0).toISOString()),
    })),
  };
}
