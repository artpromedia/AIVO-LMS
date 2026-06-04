/**
 * Classroom persistence for the school-admin console.
 *
 * Follows the dpa-store precedent (services/data-governance-svc): a common
 * interface with an in-memory implementation for tests / local dev (no
 * DATABASE_URL) and a Postgres implementation for production. `selectClassroomStore`
 * refuses the in-memory store in production so classroom state is never lost
 * on restart.
 */
import { adminClassrooms } from "@aivo/db";
import { and, eq } from "drizzle-orm";

export interface Classroom {
  id: string;
  schoolId: string;
  name: string;
  grade: string | null;
  teacherIds: string[];
  coTeacherIds: string[];
  learnerIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ClassroomFilters {
  grade?: string;
  teacherId?: string;
}

export interface ClassroomStore {
  list(schoolId: string, filters?: ClassroomFilters): Promise<Classroom[]>;
  get(id: string): Promise<Classroom | undefined>;
  insert(classroom: Classroom): Promise<void>;
  replace(classroom: Classroom): Promise<void>;
  remove(id: string): Promise<void>;
}

function applyFilters(rows: Classroom[], filters?: ClassroomFilters): Classroom[] {
  let out = rows;
  if (filters?.grade !== undefined) out = out.filter((c) => c.grade === filters.grade);
  if (filters?.teacherId !== undefined) {
    out = out.filter(
      (c) =>
        c.teacherIds.includes(filters.teacherId!) || c.coTeacherIds.includes(filters.teacherId!),
    );
  }
  return out;
}

export class InMemoryClassroomStore implements ClassroomStore {
  private readonly rows = new Map<string, Classroom>();

  async list(schoolId: string, filters?: ClassroomFilters): Promise<Classroom[]> {
    const forSchool = [...this.rows.values()].filter((c) => c.schoolId === schoolId);
    return applyFilters(forSchool, filters);
  }

  async get(id: string): Promise<Classroom | undefined> {
    const row = this.rows.get(id);
    return row ? { ...row } : undefined;
  }

  async insert(classroom: Classroom): Promise<void> {
    this.rows.set(classroom.id, { ...classroom });
  }

  async replace(classroom: Classroom): Promise<void> {
    this.rows.set(classroom.id, { ...classroom });
  }

  async remove(id: string): Promise<void> {
    this.rows.delete(id);
  }

  clear(): void {
    this.rows.clear();
  }
}

function rowToClassroom(row: typeof adminClassrooms.$inferSelect): Classroom {
  return {
    id: row.id,
    schoolId: row.schoolId,
    name: row.name,
    grade: row.grade ?? null,
    teacherIds: (row.teacherIds as string[]) ?? [],
    coTeacherIds: (row.coTeacherIds as string[]) ?? [],
    learnerIds: (row.learnerIds as string[]) ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PostgresClassroomStore implements ClassroomStore {
  constructor(private readonly db: any) {}

  async list(schoolId: string, filters?: ClassroomFilters): Promise<Classroom[]> {
    const rows = await this.db
      .select()
      .from(adminClassrooms)
      .where(eq(adminClassrooms.schoolId, schoolId));
    return applyFilters(rows.map(rowToClassroom), filters);
  }

  async get(id: string): Promise<Classroom | undefined> {
    const rows = await this.db
      .select()
      .from(adminClassrooms)
      .where(eq(adminClassrooms.id, id))
      .limit(1);
    return rows[0] ? rowToClassroom(rows[0]) : undefined;
  }

  async insert(classroom: Classroom): Promise<void> {
    await this.db.insert(adminClassrooms).values({
      id: classroom.id,
      schoolId: classroom.schoolId,
      name: classroom.name,
      grade: classroom.grade,
      teacherIds: classroom.teacherIds,
      coTeacherIds: classroom.coTeacherIds,
      learnerIds: classroom.learnerIds,
      createdAt: new Date(classroom.createdAt),
      updatedAt: new Date(classroom.updatedAt),
    });
  }

  async replace(classroom: Classroom): Promise<void> {
    await this.db
      .update(adminClassrooms)
      .set({
        name: classroom.name,
        grade: classroom.grade,
        teacherIds: classroom.teacherIds,
        coTeacherIds: classroom.coTeacherIds,
        learnerIds: classroom.learnerIds,
        updatedAt: new Date(classroom.updatedAt),
      })
      .where(
        and(eq(adminClassrooms.id, classroom.id), eq(adminClassrooms.schoolId, classroom.schoolId)),
      );
  }

  async remove(id: string): Promise<void> {
    await this.db.delete(adminClassrooms).where(eq(adminClassrooms.id, id));
  }
}

/**
 * Pick the store at boot. Postgres when DATABASE_URL is configured; the
 * in-memory store only for non-production (tests / local dev). Production
 * without a database is a hard error — classroom state must survive restart.
 */
export function selectClassroomStore(db: any): ClassroomStore {
  if (process.env.DATABASE_URL) return new PostgresClassroomStore(db);
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "admin-svc: DATABASE_URL required in production. The in-memory ClassroomStore " +
        "must NOT be used in production — classroom data would be lost on restart.",
    );
  }
  return new InMemoryClassroomStore();
}
