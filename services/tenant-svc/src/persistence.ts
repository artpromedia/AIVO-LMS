import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  tenantRosterEnrollments,
  tenantRosterStudents,
  tenantRosterTeachers,
  tenantServiceClasses,
  tenantServiceDistricts,
  tenantServiceSchools,
} from "@aivo/db";
import type { ImportPayload, ImportResult } from "./services/roster-importer.js";

export async function importRosterPersistent(db: any, payload: ImportPayload): Promise<ImportResult> {
  return db.transaction(async (tx: any) => {
    const knownSchools = new Set(payload.schools.map((school) => school.externalId));
    const warnings: string[] = [];
    for (const teacher of payload.teachers) {
      for (const schoolId of teacher.schoolExternalIds) {
        if (!knownSchools.has(schoolId)) {
          warnings.push(`teacher_${teacher.externalId}_references_unknown_school_${schoolId}`);
        }
      }
    }

    for (const school of payload.schools) {
      await tx
        .insert(tenantServiceSchools)
        .values({ districtId: payload.districtId, externalId: school.externalId, name: school.name })
        .onConflictDoUpdate({
          target: [tenantServiceSchools.districtId, tenantServiceSchools.externalId],
          set: { name: school.name, updatedAt: new Date() },
        });
    }

    for (const teacher of payload.teachers) {
      await tx
        .insert(tenantRosterTeachers)
        .values({
          districtId: payload.districtId,
          externalId: teacher.externalId,
          givenName: teacher.givenName,
          familyName: teacher.familyName,
          email: teacher.email ?? null,
          schoolExternalIds: teacher.schoolExternalIds,
        })
        .onConflictDoUpdate({
          target: [tenantRosterTeachers.districtId, tenantRosterTeachers.externalId],
          set: {
            givenName: teacher.givenName,
            familyName: teacher.familyName,
            email: teacher.email ?? null,
            schoolExternalIds: teacher.schoolExternalIds,
            updatedAt: new Date(),
          },
        });
    }

    let studentsAdded = 0;
    for (const student of payload.students) {
      const existing = await tx
        .select({ id: tenantRosterStudents.id })
        .from(tenantRosterStudents)
        .where(
          and(
            eq(tenantRosterStudents.districtId, payload.districtId),
            eq(tenantRosterStudents.externalId, student.externalId),
          ),
        )
        .limit(1);
      if (existing.length === 0) studentsAdded += 1;
      await tx
        .insert(tenantRosterStudents)
        .values({
          districtId: payload.districtId,
          externalId: student.externalId,
          givenName: student.givenName,
          familyName: student.familyName,
          schoolExternalId: student.schoolExternalId,
          grade: student.grade ?? null,
        })
        .onConflictDoUpdate({
          target: [tenantRosterStudents.districtId, tenantRosterStudents.externalId],
          set: {
            givenName: student.givenName,
            familyName: student.familyName,
            schoolExternalId: student.schoolExternalId,
            grade: student.grade ?? null,
            updatedAt: new Date(),
          },
        });
    }

    for (const klass of payload.classes) {
      const [school] = await tx
        .select({ id: tenantServiceSchools.id })
        .from(tenantServiceSchools)
        .where(
          and(
            eq(tenantServiceSchools.districtId, payload.districtId),
            eq(tenantServiceSchools.externalId, klass.schoolExternalId),
          ),
        )
        .limit(1);
      if (!school) {
        warnings.push(`class_${klass.externalId}_references_unknown_school_${klass.schoolExternalId}`);
        continue;
      }
      await tx
        .insert(tenantServiceClasses)
        .values({
          districtId: payload.districtId,
          schoolId: school.id,
          externalId: klass.externalId,
          name: klass.name,
        })
        .onConflictDoUpdate({
          target: [tenantServiceClasses.districtId, tenantServiceClasses.externalId],
          set: { schoolId: school.id, name: klass.name, updatedAt: new Date() },
        });
    }

    let enrollmentsUpserted = 0;
    for (const enrollment of payload.enrollments) {
      const inserted = await tx
        .insert(tenantRosterEnrollments)
        .values({
          districtId: payload.districtId,
          classExternalId: enrollment.classExternalId,
          studentExternalId: enrollment.studentExternalId,
        })
        .onConflictDoNothing()
        .returning({ id: tenantRosterEnrollments.id });
      enrollmentsUpserted += inserted.length;
    }

    return {
      jobId: randomUUID(),
      schoolsCreated: payload.schools.length,
      classesUpserted: payload.classes.length,
      enrollmentsUpserted,
      teachersAssigned: payload.teachers.length,
      studentsAdded,
      warnings,
      preservedParentOwnedFields: true,
    };
  });
}

export async function eraseRosterSubject(
  db: any,
  subjectId: string,
  tenantId: string | null,
): Promise<Record<string, number>> {
  const studentWhere = tenantId
    ? and(eq(tenantRosterStudents.districtId, tenantId), eq(tenantRosterStudents.externalId, subjectId))
    : eq(tenantRosterStudents.externalId, subjectId);
  const enrollmentWhere = tenantId
    ? and(
        eq(tenantRosterEnrollments.districtId, tenantId),
        eq(tenantRosterEnrollments.studentExternalId, subjectId),
      )
    : eq(tenantRosterEnrollments.studentExternalId, subjectId);
  const enrollments = await db
    .delete(tenantRosterEnrollments)
    .where(enrollmentWhere)
    .returning({ id: tenantRosterEnrollments.id });
  const students = await db
    .delete(tenantRosterStudents)
    .where(studentWhere)
    .returning({ id: tenantRosterStudents.id });
  return {
    ...(students.length ? { roster_students: students.length } : {}),
    ...(enrollments.length ? { roster_enrollments: enrollments.length } : {}),
  };
}

export async function exportRosterSubject(db: any, subjectId: string, tenantId: string | null) {
  const studentWhere = tenantId
    ? and(eq(tenantRosterStudents.districtId, tenantId), eq(tenantRosterStudents.externalId, subjectId))
    : eq(tenantRosterStudents.externalId, subjectId);
  const enrollmentWhere = tenantId
    ? and(
        eq(tenantRosterEnrollments.districtId, tenantId),
        eq(tenantRosterEnrollments.studentExternalId, subjectId),
      )
    : eq(tenantRosterEnrollments.studentExternalId, subjectId);
  const students = await db.select().from(tenantRosterStudents).where(studentWhere);
  const enrollments = await db.select().from(tenantRosterEnrollments).where(enrollmentWhere);
  return {
    counts: {
      ...(students.length ? { roster_students: students.length } : {}),
      ...(enrollments.length ? { roster_enrollments: enrollments.length } : {}),
    },
    bundle: { roster_students: students, roster_enrollments: enrollments },
  };
}

export { tenantServiceClasses, tenantServiceDistricts, tenantServiceSchools };
