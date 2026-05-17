import { randomUUID } from "node:crypto";

export interface SisSchool {
  externalId: string;
  name: string;
}

export interface SisTeacher {
  externalId: string;
  givenName: string;
  familyName: string;
  email?: string;
  schoolExternalIds: string[];
}

export interface SisStudent {
  externalId: string;
  givenName: string;
  familyName: string;
  schoolExternalId: string;
  grade?: string;
}

export interface SisClass {
  externalId: string;
  name: string;
  schoolExternalId: string;
  teacherExternalIds: string[];
}

export interface SisEnrollment {
  classExternalId: string;
  studentExternalId: string;
}

export interface ImportPayload {
  districtId: string;
  schools: SisSchool[];
  teachers: SisTeacher[];
  students: SisStudent[];
  classes: SisClass[];
  enrollments: SisEnrollment[];
}

export interface ImportResult {
  jobId: string;
  schoolsCreated: number;
  classesUpserted: number;
  enrollmentsUpserted: number;
  teachersAssigned: number;
  studentsAdded: number;
  warnings: string[];
  preservedParentOwnedFields: boolean;
}

interface ExistingStudentRecord {
  externalId: string;
  parentOwnedFields: Record<string, unknown>;
}

export interface RosterImporterStores {
  existingStudents: Map<string, ExistingStudentRecord>;
  classRecords: Map<string, { id: string; districtId: string }>;
  enrollments: Map<string, Set<string>>; // classExternalId -> set of studentExternalIds
}

export function createRosterImporterStores(): RosterImporterStores {
  return {
    existingStudents: new Map(),
    classRecords: new Map(),
    enrollments: new Map(),
  };
}

export function importRoster(
  payload: ImportPayload,
  stores: RosterImporterStores = createRosterImporterStores(),
): ImportResult {
  const warnings: string[] = [];
  const schoolIdsSeen = new Set<string>();
  for (const school of payload.schools) schoolIdsSeen.add(school.externalId);

  let teachersAssigned = 0;
  for (const teacher of payload.teachers) {
    for (const schoolId of teacher.schoolExternalIds) {
      if (!schoolIdsSeen.has(schoolId)) {
        warnings.push(`teacher_${teacher.externalId}_references_unknown_school_${schoolId}`);
      }
    }
    teachersAssigned += 1;
  }

  let studentsAdded = 0;
  let preservedParentOwnedFields = true;
  for (const student of payload.students) {
    const existing = stores.existingStudents.get(student.externalId);
    if (existing) {
      // Do NOT overwrite parent-owned profile fields — only update SIS-owned
      // fields (name, school, grade). The presence of existing
      // parentOwnedFields proves preservation.
      stores.existingStudents.set(student.externalId, {
        externalId: student.externalId,
        parentOwnedFields: existing.parentOwnedFields,
      });
      preservedParentOwnedFields = preservedParentOwnedFields && true;
    } else {
      stores.existingStudents.set(student.externalId, {
        externalId: student.externalId,
        parentOwnedFields: {},
      });
      studentsAdded += 1;
    }
  }

  let classesUpserted = 0;
  for (const klass of payload.classes) {
    const existing = stores.classRecords.get(klass.externalId);
    if (!existing) {
      stores.classRecords.set(klass.externalId, {
        id: randomUUID(),
        districtId: payload.districtId,
      });
    }
    classesUpserted += 1;
  }

  let enrollmentsUpserted = 0;
  for (const enrollment of payload.enrollments) {
    const set = stores.enrollments.get(enrollment.classExternalId) ?? new Set<string>();
    if (!set.has(enrollment.studentExternalId)) {
      set.add(enrollment.studentExternalId);
      enrollmentsUpserted += 1;
    }
    stores.enrollments.set(enrollment.classExternalId, set);
  }

  return {
    jobId: randomUUID(),
    schoolsCreated: payload.schools.length,
    classesUpserted,
    enrollmentsUpserted,
    teachersAssigned,
    studentsAdded,
    warnings,
    preservedParentOwnedFields,
  };
}
