/**
 * Drizzle-backed AdminStore — stub.
 *
 * `packages/db/src/schema/{tenancy,districts,admin}.ts` ship the
 * school + classroom + enrollment schemas. The Drizzle
 * implementation is a follow-up that:
 *
 *   1. Adds a UNIQUE constraint on
 *      (classroom_id, subject_id, role) so `findEnrollmentByNaturalKey`
 *      can be replaced by an INSERT … ON CONFLICT DO NOTHING with a
 *      RETURNING clause.
 *   2. Wraps upsertTeacherAssignment in a CTE so the validation
 *      that learnerIds belong to tenantId becomes a single round-trip.
 */
import type { AdminStore } from "../types";

function notImplemented(method: string): never {
  throw new Error(
    `[persistence.drizzle.admin.${method}] not implemented. ` +
      `Wire packages/db schools/classrooms/enrollments/teacherAssignments ` +
      `into the adapter before flipping AIVO_PERSISTENCE_ADMIN=postgres.`,
  );
}

export const drizzleAdmin: AdminStore = {
  async listSchools() {
    return notImplemented("listSchools");
  },
  async getSchoolById() {
    return notImplemented("getSchoolById");
  },
  async listClassrooms() {
    return notImplemented("listClassrooms");
  },
  async getClassroomById() {
    return notImplemented("getClassroomById");
  },
  async upsertClassroom() {
    return notImplemented("upsertClassroom");
  },
  async listEnrollmentsForClassroom() {
    return notImplemented("listEnrollmentsForClassroom");
  },
  async upsertEnrollment() {
    return notImplemented("upsertEnrollment");
  },
  async findEnrollmentByNaturalKey() {
    return notImplemented("findEnrollmentByNaturalKey");
  },
  async listTeacherAssignments() {
    return notImplemented("listTeacherAssignments");
  },
  async getTeacherAssignmentById() {
    return notImplemented("getTeacherAssignmentById");
  },
  async upsertTeacherAssignment() {
    return notImplemented("upsertTeacherAssignment");
  },
  async deleteTeacherAssignment() {
    return notImplemented("deleteTeacherAssignment");
  },
};
