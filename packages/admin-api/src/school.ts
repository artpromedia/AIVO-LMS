import "server-only";

import { adminGet } from "./client";
import type { SessionProfile } from "@aivo/admin-auth/types";

/**
 * School overview read model (services/admin-svc/src/routes/school-overview.ts):
 * real learner/teacher/class counts, learners grouped by grade, per-class
 * sizes, a 7-day lesson-run activity series, and the latest runs. For school
 * admins the session `tenantId` is the school id (same convention as the
 * classroom routes).
 */
export interface SchoolOverview {
  schoolId: string;
  generatedAt: string;
  windowDays: number;
  counts: { learners: number; teachers: number; classes: number };
  learnersByGrade: Array<{ grade: string; count: number }>;
  classSizes: Array<{ id: string; name: string; grade: string | null; learners: number }>;
  activity: Array<{ day: string; lessonRuns: number }>;
  recent: Array<{ id: string; learnerName: string; status: string; createdAt: string }>;
}

export async function getSchoolOverview(
  session: Pick<SessionProfile, "role" | "tenantId">,
): Promise<SchoolOverview> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    `/admin/schools/${encodeURIComponent(session.tenantId)}/overview`,
  );
  const counts = (payload.counts ?? {}) as Record<string, unknown>;
  const list = <T>(value: unknown, map: (row: Record<string, unknown>) => T): T[] =>
    Array.isArray(value) ? value.map((row) => map(row as Record<string, unknown>)) : [];
  return {
    schoolId: String(payload.schoolId ?? session.tenantId),
    generatedAt: String(payload.generatedAt ?? new Date(0).toISOString()),
    windowDays: Number(payload.windowDays ?? 7),
    counts: {
      learners: Number(counts.learners ?? 0),
      teachers: Number(counts.teachers ?? 0),
      classes: Number(counts.classes ?? 0),
    },
    learnersByGrade: list(payload.learnersByGrade, (row) => ({
      grade: String(row.grade ?? "Ungraded"),
      count: Number(row.count ?? 0),
    })),
    classSizes: list(payload.classSizes, (row) => ({
      id: String(row.id),
      name: String(row.name ?? row.id),
      grade: row.grade ? String(row.grade) : null,
      learners: Number(row.learners ?? 0),
    })),
    activity: list(payload.activity, (row) => ({
      day: String(row.day ?? ""),
      lessonRuns: Number(row.lessonRuns ?? 0),
    })),
    recent: list(payload.recent, (row) => ({
      id: String(row.id),
      learnerName: String(row.learnerName ?? row.id),
      status: String(row.status ?? "unknown"),
      createdAt: String(row.createdAt ?? new Date(0).toISOString()),
    })),
  };
}
