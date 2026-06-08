/**
 * Drizzle-backed RosteringStore — the web_* rostering / SIS / lesson-sync
 * tables. Tenant scoping + sort + optimistic-concurrency logic live in the
 * repo layer; this is a plain row store keyed identically to the memory store
 * (lesson sync by lessonRunId). Canonical SIS sync / rostering grant are read
 * over REST (lib/rostering/integrations-svc-client.ts), never here.
 */
import { eq } from "drizzle-orm";
import {
  webCourses,
  webRosterImportJobs,
  webRosterImportErrors,
  webSisConnections,
  webExternalRosterMappings,
  webLessonSyncStates,
} from "@aivo/db";
import type {
  Course,
  ExternalRosterMapping,
  LessonSyncState,
  RosterImportError,
  RosterImportJob,
  SISConnection,
} from "@/lib/db/types";
import type { RosteringStore } from "../types";
import { getDb } from "./client";

export const drizzleRostering: RosteringStore = {
  async listCoursesForTenant(tenantId): Promise<Course[]> {
    const rows = await getDb().select().from(webCourses).where(eq(webCourses.tenantId, tenantId));
    return rows.map((r) => r.data as Course);
  },
  async upsertImportJob(job): Promise<RosterImportJob> {
    await getDb()
      .insert(webRosterImportJobs)
      .values({ id: job.id, tenantId: job.tenantId, data: job })
      .onConflictDoUpdate({
        target: webRosterImportJobs.id,
        set: { tenantId: job.tenantId, data: job },
      });
    return job;
  },
  async getImportJobById(jobId): Promise<RosterImportJob | null> {
    const [row] = await getDb()
      .select()
      .from(webRosterImportJobs)
      .where(eq(webRosterImportJobs.id, jobId))
      .limit(1);
    return row ? (row.data as RosterImportJob) : null;
  },
  async listImportJobsForTenant(tenantId): Promise<RosterImportJob[]> {
    const rows = await getDb()
      .select()
      .from(webRosterImportJobs)
      .where(eq(webRosterImportJobs.tenantId, tenantId));
    return rows.map((r) => r.data as RosterImportJob);
  },
  async appendImportError(error): Promise<RosterImportError> {
    await getDb()
      .insert(webRosterImportErrors)
      .values({ id: error.id, jobId: error.jobId, data: error })
      .onConflictDoNothing({ target: webRosterImportErrors.id });
    return error;
  },
  async listImportErrors(jobId): Promise<RosterImportError[]> {
    const rows = await getDb()
      .select()
      .from(webRosterImportErrors)
      .where(eq(webRosterImportErrors.jobId, jobId));
    return rows.map((r) => r.data as RosterImportError);
  },
  async listSISConnectionsForTenant(tenantId): Promise<SISConnection[]> {
    const rows = await getDb()
      .select()
      .from(webSisConnections)
      .where(eq(webSisConnections.tenantId, tenantId));
    return rows.map((r) => r.data as SISConnection);
  },
  async listExternalMappingsForConnection(connectionId): Promise<ExternalRosterMapping[]> {
    const rows = await getDb()
      .select()
      .from(webExternalRosterMappings)
      .where(eq(webExternalRosterMappings.connectionId, connectionId));
    return rows.map((r) => r.data as ExternalRosterMapping);
  },
  async getLessonSyncState(lessonRunId): Promise<LessonSyncState | null> {
    const [row] = await getDb()
      .select()
      .from(webLessonSyncStates)
      .where(eq(webLessonSyncStates.lessonRunId, lessonRunId))
      .limit(1);
    return row ? (row.data as LessonSyncState) : null;
  },
  async upsertLessonSyncState(state): Promise<LessonSyncState> {
    await getDb()
      .insert(webLessonSyncStates)
      .values({ lessonRunId: state.lessonRunId, tenantId: state.tenantId, data: state })
      .onConflictDoUpdate({
        target: webLessonSyncStates.lessonRunId,
        set: { tenantId: state.tenantId, data: state },
      });
    return state;
  },
};
