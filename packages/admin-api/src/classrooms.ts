import "server-only";

import { adminGet } from "./client";
import type { SessionProfile } from "@aivo/admin-auth/types";

/**
 * Read-only admin-api surface for school classrooms.
 *
 * Wraps the admin-svc classroom routes (services/admin-svc/src/routes/classrooms.ts):
 *   - GET /admin/schools/:schoolId/classrooms        -> { classrooms, total }
 *   - GET /admin/schools/:schoolId/classrooms/:id     -> classroom detail object
 *
 * The classroom routes are scoped by school. For school admins the session's
 * `tenantId` is the school id, so it is used as the `:schoolId` path segment.
 * Mirrors the DTO-mapping / summary-vs-detail style of platform.ts.
 */

/** Summary row for a classroom, used in list views. */
export interface AdminClassroomSummary {
  id: string;
  schoolId: string;
  name: string;
  grade: string | null;
  teacherCount: number;
  learnerCount: number;
  createdAt: string;
  updatedAt: string | null;
}

/** Full classroom detail, including roster id lists. */
export interface AdminClassroomDetail extends AdminClassroomSummary {
  teacherIds: string[];
  coTeacherIds: string[];
  learnerIds: string[];
}

type ClassroomSession = Pick<SessionProfile, "role" | "tenantId">;

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

function mapClassroom(row: Record<string, unknown>): AdminClassroomSummary {
  const teacherIds = toStringArray(row.teacherIds);
  const coTeacherIds = toStringArray(row.coTeacherIds);
  const learnerIds = toStringArray(row.learnerIds);
  return {
    id: String(row.id),
    schoolId: String(row.schoolId),
    name: String(row.name ?? row.id),
    grade: row.grade ? String(row.grade) : null,
    teacherCount: teacherIds.length + coTeacherIds.length,
    learnerCount: learnerIds.length,
    createdAt: String(row.createdAt ?? new Date(0).toISOString()),
    updatedAt: row.updatedAt ? String(row.updatedAt) : null,
  };
}

function mapClassroomDetail(row: Record<string, unknown>): AdminClassroomDetail {
  return {
    ...mapClassroom(row),
    teacherIds: toStringArray(row.teacherIds),
    coTeacherIds: toStringArray(row.coTeacherIds),
    learnerIds: toStringArray(row.learnerIds),
  };
}

export async function listAdminClassrooms(
  session: ClassroomSession,
): Promise<AdminClassroomSummary[]> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    `/admin/schools/${encodeURIComponent(session.tenantId)}/classrooms`,
  );
  const rows = Array.isArray(payload.classrooms) ? payload.classrooms : [];
  return rows.map((row) => mapClassroom(row as Record<string, unknown>));
}

export async function getAdminClassroom(
  session: ClassroomSession,
  classroomId: string,
): Promise<AdminClassroomDetail> {
  const row = await adminGet<Record<string, unknown>>(
    session,
    `/admin/schools/${encodeURIComponent(session.tenantId)}/classrooms/${encodeURIComponent(classroomId)}`,
  );
  return mapClassroomDetail(row);
}
