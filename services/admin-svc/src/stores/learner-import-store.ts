/**
 * Learner bulk-import persistence for the school-admin console.
 *
 * Two durable concerns:
 *   - import jobs (resumable cursor + status), keyed by jobId
 *   - imported learner rows, upserted idempotently by (schoolId, external_id)
 *
 * The @aivo/learner-import engine's `apply` callback is synchronous, so the
 * route pre-loads existing external_ids for sync classification, stages the
 * processed rows, then calls `upsertLearners` once the chunked run finishes.
 * Follows the dpa-store precedent: in-memory for tests / local dev, Postgres
 * for production.
 */
import { learnerImportJobs, learnerImportRecords } from "@aivo/db";
import type { NormalizedLearner, ImportProgress } from "@aivo/learner-import";
import { eq, sql } from "drizzle-orm";

export type JobStatus = "pending" | "running" | "done" | "failed";

export interface ImportJobRecord {
  jobId: string;
  schoolId: string;
  status: JobStatus;
  progress: ImportProgress;
  errors?: string[] | null;
}

export interface LearnerImportStore {
  getJob(jobId: string): Promise<ImportJobRecord | undefined>;
  saveJob(job: ImportJobRecord): Promise<void>;
  existingExternalIds(schoolId: string): Promise<Set<string>>;
  upsertLearners(schoolId: string, rows: NormalizedLearner[]): Promise<void>;
}

export class InMemoryLearnerImportStore implements LearnerImportStore {
  private readonly jobs = new Map<string, ImportJobRecord>();
  private readonly learners = new Map<string, Map<string, NormalizedLearner>>();

  private forSchool(schoolId: string): Map<string, NormalizedLearner> {
    let store = this.learners.get(schoolId);
    if (!store) {
      store = new Map();
      this.learners.set(schoolId, store);
    }
    return store;
  }

  async getJob(jobId: string): Promise<ImportJobRecord | undefined> {
    const job = this.jobs.get(jobId);
    return job ? { ...job } : undefined;
  }

  async saveJob(job: ImportJobRecord): Promise<void> {
    this.jobs.set(job.jobId, { ...job });
  }

  async existingExternalIds(schoolId: string): Promise<Set<string>> {
    return new Set(this.forSchool(schoolId).keys());
  }

  async upsertLearners(schoolId: string, rows: NormalizedLearner[]): Promise<void> {
    const store = this.forSchool(schoolId);
    for (const row of rows) store.set(row.external_id, row);
  }

  clear(): void {
    this.jobs.clear();
    this.learners.clear();
  }
}

export class PostgresLearnerImportStore implements LearnerImportStore {
  constructor(private readonly db: any) {}

  async getJob(jobId: string): Promise<ImportJobRecord | undefined> {
    const rows = await this.db
      .select()
      .from(learnerImportJobs)
      .where(eq(learnerImportJobs.jobId, jobId))
      .limit(1);
    const row = rows[0];
    if (!row) return undefined;
    return {
      jobId: row.jobId,
      schoolId: row.schoolId,
      status: row.status as JobStatus,
      progress: row.progress as ImportProgress,
      errors: (row.errors as string[] | null) ?? null,
    };
  }

  async saveJob(job: ImportJobRecord): Promise<void> {
    await this.db
      .insert(learnerImportJobs)
      .values({
        jobId: job.jobId,
        schoolId: job.schoolId,
        status: job.status,
        progress: job.progress,
        errors: job.errors ?? null,
      })
      .onConflictDoUpdate({
        target: learnerImportJobs.jobId,
        set: {
          status: job.status,
          progress: job.progress,
          errors: job.errors ?? null,
          updatedAt: new Date(),
        },
      });
  }

  async existingExternalIds(schoolId: string): Promise<Set<string>> {
    const rows = await this.db
      .select({ externalId: learnerImportRecords.externalId })
      .from(learnerImportRecords)
      .where(eq(learnerImportRecords.schoolId, schoolId));
    return new Set(rows.map((r: { externalId: string }) => r.externalId));
  }

  async upsertLearners(schoolId: string, rows: NormalizedLearner[]): Promise<void> {
    if (rows.length === 0) return;
    const values = rows.map((row) => ({
      schoolId,
      externalId: row.external_id,
      data: row,
    }));
    await this.db
      .insert(learnerImportRecords)
      .values(values)
      .onConflictDoUpdate({
        target: [learnerImportRecords.schoolId, learnerImportRecords.externalId],
        // In a bulk upsert, set the conflicting row's `data` to the incoming
        // value via the EXCLUDED pseudo-table.
        set: { data: sql`excluded.data`, updatedAt: new Date() },
      });
  }
}

export function selectLearnerImportStore(db: any): LearnerImportStore {
  if (process.env.DATABASE_URL) return new PostgresLearnerImportStore(db);
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "admin-svc: DATABASE_URL required in production. The in-memory LearnerImportStore " +
        "must NOT be used in production — import jobs and learner rows would be lost on restart.",
    );
  }
  return new InMemoryLearnerImportStore();
}
