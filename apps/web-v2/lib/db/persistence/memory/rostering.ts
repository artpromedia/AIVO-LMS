/**
 * In-memory RosteringStore — wraps courses / rosterImportJobs /
 * rosterImportErrors / sisConnections / externalRosterMappings /
 * lessonSyncStates Maps. Test-only reference semantics; the repo layer owns
 * sorting/filtering + optimistic-concurrency logic, so the store is a plain
 * row store keyed the same way the legacy code keyed it (lesson sync by
 * lessonRunId).
 */
import { getStore } from "@/lib/db/store";
import type {
  Course,
  ExternalRosterMapping,
  LessonSyncState,
  RosterImportError,
  RosterImportJob,
  SISConnection,
} from "@/lib/db/types";
import type { RosteringStore } from "../types";

export const memoryRostering: RosteringStore = {
  async listCoursesForTenant(tenantId): Promise<Course[]> {
    return Array.from(getStore().courses.values()).filter((c) => c.tenantId === tenantId);
  },
  async upsertImportJob(job): Promise<RosterImportJob> {
    getStore().rosterImportJobs.set(job.id, job);
    return job;
  },
  async getImportJobById(jobId): Promise<RosterImportJob | null> {
    return getStore().rosterImportJobs.get(jobId) ?? null;
  },
  async listImportJobsForTenant(tenantId): Promise<RosterImportJob[]> {
    return Array.from(getStore().rosterImportJobs.values()).filter((j) => j.tenantId === tenantId);
  },
  async appendImportError(error): Promise<RosterImportError> {
    getStore().rosterImportErrors.set(error.id, error);
    return error;
  },
  async listImportErrors(jobId): Promise<RosterImportError[]> {
    return Array.from(getStore().rosterImportErrors.values()).filter((e) => e.jobId === jobId);
  },
  async listSISConnectionsForTenant(tenantId): Promise<SISConnection[]> {
    return Array.from(getStore().sisConnections.values()).filter((c) => c.tenantId === tenantId);
  },
  async listExternalMappingsForConnection(connectionId): Promise<ExternalRosterMapping[]> {
    return Array.from(getStore().externalRosterMappings.values()).filter(
      (m) => m.connectionId === connectionId,
    );
  },
  async getLessonSyncState(lessonRunId): Promise<LessonSyncState | null> {
    return getStore().lessonSyncStates.get(lessonRunId) ?? null;
  },
  async upsertLessonSyncState(state): Promise<LessonSyncState> {
    getStore().lessonSyncStates.set(state.lessonRunId, state);
    return state;
  },
};
