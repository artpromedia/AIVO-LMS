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

export interface SisProvider {
  name: string;
  listSchools(): Promise<SisSchool[]>;
  listTeachers(): Promise<SisTeacher[]>;
  listStudents(): Promise<SisStudent[]>;
  listClasses(): Promise<SisClass[]>;
  listEnrollments(): Promise<SisEnrollment[]>;
}

export interface NormalizedRosterExport {
  schools: SisSchool[];
  teachers: SisTeacher[];
  students: SisStudent[];
  classes: SisClass[];
  enrollments: SisEnrollment[];
}

export class NormalizedExportSisProvider implements SisProvider {
  readonly name: string;
  constructor(
    name: string,
    private readonly snapshot: NormalizedRosterExport,
  ) {
    this.name = name;
  }

  async listSchools(): Promise<SisSchool[]> {
    return this.snapshot.schools;
  }

  async listTeachers(): Promise<SisTeacher[]> {
    return this.snapshot.teachers;
  }

  async listStudents(): Promise<SisStudent[]> {
    return this.snapshot.students;
  }

  async listClasses(): Promise<SisClass[]> {
    return this.snapshot.classes;
  }

  async listEnrollments(): Promise<SisEnrollment[]> {
    return this.snapshot.enrollments;
  }
}
