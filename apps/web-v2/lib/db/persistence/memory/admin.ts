/**
 * In-memory AdminStore — wraps schools / classrooms / enrollments /
 * teacherAssignments Maps. Selected when AIVO_PERSISTENCE_ADMIN=memory
 * (the default).
 *
 * Sort order matches the legacy repo functions:
 *   - schools / classrooms / enrollments: by display name / role.
 *   - teacher assignments: newest-first by createdAt.
 */
import { getStore } from "@/lib/db/store";
import type {
  CalendarEvent,
  Classroom,
  Enrollment,
  School,
  TeacherAssignment,
} from "@/lib/db/types";
import type { AdminStore } from "../types";

export const memoryAdmin: AdminStore = {
  async listSchools(tenantId): Promise<School[]> {
    let arr = Array.from(getStore().schools.values());
    if (tenantId) arr = arr.filter((s) => s.tenantId === tenantId);
    return arr.sort((a, b) => a.name.localeCompare(b.name));
  },

  async getSchoolById(id) {
    return getStore().schools.get(id) ?? null;
  },

  async listClassrooms({ tenantId, schoolId, teacherUserId }): Promise<Classroom[]> {
    let arr = Array.from(getStore().classrooms.values()).filter((c) => c.tenantId === tenantId);
    if (schoolId) arr = arr.filter((c) => c.schoolId === schoolId);
    if (teacherUserId) arr = arr.filter((c) => c.teacherUserId === teacherUserId);
    return arr.sort((a, b) => a.name.localeCompare(b.name));
  },

  async getClassroomById(id, tenantId) {
    const c = getStore().classrooms.get(id);
    return c && c.tenantId === tenantId ? c : null;
  },

  async upsertClassroom(classroom: Classroom) {
    getStore().classrooms.set(classroom.id, classroom);
    return classroom;
  },

  async listEnrollmentsForClassroom(classroomId): Promise<Enrollment[]> {
    return Array.from(getStore().enrollments.values())
      .filter((e) => e.classroomId === classroomId)
      .sort((a, b) => a.role.localeCompare(b.role));
  },

  async upsertEnrollment(enrollment: Enrollment) {
    getStore().enrollments.set(enrollment.id, enrollment);
    return enrollment;
  },

  async findEnrollmentByNaturalKey({ classroomId, subjectId, role }) {
    for (const e of getStore().enrollments.values()) {
      if (e.classroomId === classroomId && e.subjectId === subjectId && e.role === role) {
        return e;
      }
    }
    return null;
  },

  async listTeacherAssignments(teacherId, tenantId, opts): Promise<TeacherAssignment[]> {
    const all = Array.from(getStore().teacherAssignments.values())
      .filter((a) => a.teacherId === teacherId && a.tenantId === tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return opts?.status ? all.filter((a) => a.status === opts.status) : all;
  },

  async getTeacherAssignmentById(assignmentId, teacherId, tenantId) {
    const a = getStore().teacherAssignments.get(assignmentId);
    if (!a || a.tenantId !== tenantId || a.teacherId !== teacherId) return null;
    return a;
  },

  async upsertTeacherAssignment(assignment: TeacherAssignment) {
    getStore().teacherAssignments.set(assignment.id, assignment);
    return assignment;
  },

  async deleteTeacherAssignment(assignmentId, teacherId, tenantId) {
    const store = getStore();
    const a = store.teacherAssignments.get(assignmentId);
    if (!a || a.tenantId !== tenantId || a.teacherId !== teacherId) return false;
    store.teacherAssignments.delete(assignmentId);
    return true;
  },

  async listCalendarEventsForTeacher(teacherUserId, tenantId, opts): Promise<CalendarEvent[]> {
    let arr = Array.from(getStore().calendarEvents.values()).filter(
      (e) => e.tenantId === tenantId && e.teacherUserId === teacherUserId,
    );
    if (opts?.fromIso) arr = arr.filter((e) => e.date >= opts.fromIso!);
    arr = arr.sort((a, b) => a.date.localeCompare(b.date));
    return opts?.limit ? arr.slice(0, opts.limit) : arr;
  },

  async upsertCalendarEvent(event: CalendarEvent) {
    getStore().calendarEvents.set(event.id, event);
    return event;
  },
};
