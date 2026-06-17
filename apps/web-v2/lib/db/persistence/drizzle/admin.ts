/**
 * Drizzle-backed AdminStore — schools / classrooms / enrollments /
 * teacher assignments. Tenant-scoped fetches via indexed columns; the
 * memory store's localeCompare / createdAt sort + secondary predicates
 * (schoolId, teacherUserId, status, natural key) are applied in app
 * code so the behaviour is byte-for-byte equivalent.
 */
import { and, eq } from "drizzle-orm";
import {
  webSchools,
  webClassrooms,
  webEnrollments,
  webTeacherAssignments,
  webCalendarEvents,
} from "@aivo/db";
import type {
  CalendarEvent,
  Classroom,
  Enrollment,
  School,
  TeacherAssignment,
} from "@/lib/db/types";
import type { AdminStore } from "../types";
import { getDb } from "./client";

export const drizzleAdmin: AdminStore = {
  async listSchools(tenantId) {
    const db = getDb();
    const rows = tenantId
      ? await db.select().from(webSchools).where(eq(webSchools.tenantId, tenantId))
      : await db.select().from(webSchools);
    return rows.map((r) => r.data as School).sort((a, b) => a.name.localeCompare(b.name));
  },

  async getSchoolById(id) {
    const [row] = await getDb().select().from(webSchools).where(eq(webSchools.id, id)).limit(1);
    return row ? (row.data as School) : null;
  },

  async listClassrooms({ tenantId, schoolId, teacherUserId }) {
    const rows = await getDb()
      .select()
      .from(webClassrooms)
      .where(eq(webClassrooms.tenantId, tenantId));
    let arr = rows.map((r) => r.data as Classroom);
    if (schoolId) arr = arr.filter((c) => c.schoolId === schoolId);
    if (teacherUserId) arr = arr.filter((c) => c.teacherUserId === teacherUserId);
    return arr.sort((a, b) => a.name.localeCompare(b.name));
  },

  async getClassroomById(id, tenantId) {
    const [row] = await getDb()
      .select()
      .from(webClassrooms)
      .where(and(eq(webClassrooms.id, id), eq(webClassrooms.tenantId, tenantId)))
      .limit(1);
    return row ? (row.data as Classroom) : null;
  },

  async upsertClassroom(classroom) {
    const db = getDb();
    await db
      .insert(webClassrooms)
      .values({ id: classroom.id, tenantId: classroom.tenantId, data: classroom })
      .onConflictDoUpdate({
        target: webClassrooms.id,
        set: { tenantId: classroom.tenantId, data: classroom },
      });
    return classroom;
  },

  async listEnrollmentsForClassroom(classroomId) {
    const rows = await getDb()
      .select()
      .from(webEnrollments)
      .where(eq(webEnrollments.classroomId, classroomId));
    return rows.map((r) => r.data as Enrollment).sort((a, b) => a.role.localeCompare(b.role));
  },

  async upsertEnrollment(enrollment) {
    const db = getDb();
    await db
      .insert(webEnrollments)
      .values({
        id: enrollment.id,
        classroomId: enrollment.classroomId,
        tenantId: enrollment.tenantId,
        data: enrollment,
      })
      .onConflictDoUpdate({
        target: webEnrollments.id,
        set: {
          classroomId: enrollment.classroomId,
          tenantId: enrollment.tenantId,
          data: enrollment,
        },
      });
    return enrollment;
  },

  async findEnrollmentByNaturalKey({ classroomId, subjectId, role }) {
    const rows = await getDb()
      .select()
      .from(webEnrollments)
      .where(eq(webEnrollments.classroomId, classroomId));
    return (
      rows
        .map((r) => r.data as Enrollment)
        .find((e) => e.subjectId === subjectId && e.role === role) ?? null
    );
  },

  async listTeacherAssignments(teacherId, tenantId, opts) {
    const rows = await getDb()
      .select()
      .from(webTeacherAssignments)
      .where(
        and(
          eq(webTeacherAssignments.teacherId, teacherId),
          eq(webTeacherAssignments.tenantId, tenantId),
        ),
      );
    const all = rows
      .map((r) => r.data as TeacherAssignment)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return opts?.status ? all.filter((a) => a.status === opts.status) : all;
  },

  async getTeacherAssignmentById(assignmentId, teacherId, tenantId) {
    const [row] = await getDb()
      .select()
      .from(webTeacherAssignments)
      .where(
        and(
          eq(webTeacherAssignments.id, assignmentId),
          eq(webTeacherAssignments.teacherId, teacherId),
          eq(webTeacherAssignments.tenantId, tenantId),
        ),
      )
      .limit(1);
    return row ? (row.data as TeacherAssignment) : null;
  },

  async upsertTeacherAssignment(assignment) {
    const db = getDb();
    await db
      .insert(webTeacherAssignments)
      .values({
        id: assignment.id,
        teacherId: assignment.teacherId,
        tenantId: assignment.tenantId,
        data: assignment,
      })
      .onConflictDoUpdate({
        target: webTeacherAssignments.id,
        set: { teacherId: assignment.teacherId, tenantId: assignment.tenantId, data: assignment },
      });
    return assignment;
  },

  async deleteTeacherAssignment(assignmentId, teacherId, tenantId) {
    const deleted = await getDb()
      .delete(webTeacherAssignments)
      .where(
        and(
          eq(webTeacherAssignments.id, assignmentId),
          eq(webTeacherAssignments.teacherId, teacherId),
          eq(webTeacherAssignments.tenantId, tenantId),
        ),
      )
      .returning({ id: webTeacherAssignments.id });
    return deleted.length > 0;
  },

  async listCalendarEventsForTeacher(teacherUserId, tenantId, opts) {
    const rows = await getDb()
      .select()
      .from(webCalendarEvents)
      .where(
        and(
          eq(webCalendarEvents.tenantId, tenantId),
          eq(webCalendarEvents.teacherUserId, teacherUserId),
        ),
      );
    let arr = rows.map((r) => r.data as CalendarEvent);
    if (opts?.fromIso) arr = arr.filter((e) => e.date >= opts.fromIso!);
    arr = arr.sort((a, b) => a.date.localeCompare(b.date));
    return opts?.limit ? arr.slice(0, opts.limit) : arr;
  },

  async upsertCalendarEvent(event) {
    const db = getDb();
    await db
      .insert(webCalendarEvents)
      .values({
        id: event.id,
        tenantId: event.tenantId,
        teacherUserId: event.teacherUserId,
        data: event,
      })
      .onConflictDoUpdate({
        target: webCalendarEvents.id,
        set: { tenantId: event.tenantId, teacherUserId: event.teacherUserId, data: event },
      });
    return event;
  },
};
