/**
 * rostering / SIS / lesson-sync — memory == postgres parity (Sprint 6).
 *
 * Web-owned aggregates: roster-import job + per-row errors (durable +
 * re-runnable), the SIS connection / external-mapping reads web surfaces, and
 * the multi-device lesson-sync state (keyed by lessonRunId, optimistic
 * concurrency on `version`). Canonical SIS sync is integrations-svc's.
 */
import { it, expect } from "vitest";
import type {
  RosterImportError,
  RosterImportJob,
} from "@/lib/db/types";
import {
  getRosterImportJob,
  getRosterImportJobAny,
  listRosterImportJobs,
  listRosterImportErrors,
  getLessonSyncState,
  putLessonSyncState,
} from "@/lib/db/repos";
import { getPersistence } from "@/lib/db/persistence";
import { runInBothModes } from "./parity.harness";

const T = "t_rostering_parity";
const SCHOOL = "school-rostering";

function job(id: string, over: Partial<RosterImportJob> = {}): RosterImportJob {
  return {
    id,
    tenantId: T,
    schoolId: SCHOOL,
    source: "csv",
    status: "completed",
    totalRows: 3,
    createdRows: 3,
    updatedRows: 0,
    skippedRows: 0,
    errorRows: 0,
    dryRun: false,
    createdByUserId: "u_admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:01:00.000Z",
    ...over,
  } as RosterImportJob;
}

runInBothModes("rostering", () => {
  it("import job upsert: tenant-scoped get + cross-tenant escape hatch + list newest-first", async () => {
    const rostering = getPersistence().rostering;
    await rostering.upsertImportJob(job("job-1", { createdAt: "2026-01-01T00:00:00.000Z" }));
    await rostering.upsertImportJob(job("job-2", { createdAt: "2026-02-01T00:00:00.000Z" }));

    // tenant-scoped get
    expect((await getRosterImportJob("job-1", T))?.id).toBe("job-1");
    expect(await getRosterImportJob("job-1", "t_wrong")).toBeNull();
    // platform-admin escape hatch ignores tenant
    expect((await getRosterImportJobAny("job-1"))?.id).toBe("job-1");
    // list is newest-createdAt first and schoolId-filterable
    const list = await listRosterImportJobs(T);
    expect(list.map((j) => j.id)).toEqual(["job-2", "job-1"]);
    expect((await listRosterImportJobs(T, "other-school")).length).toBe(0);
  });

  it("import errors append and list sorted by rowNumber", async () => {
    const rostering = getPersistence().rostering;
    const err = (id: string, rowNumber: number): RosterImportError =>
      ({ id, jobId: "job-err", rowNumber, row: {}, message: "bad" }) as RosterImportError;
    await rostering.appendImportError(err("e2", 5));
    await rostering.appendImportError(err("e1", 1));
    expect((await listRosterImportErrors("job-err")).map((e) => e.rowNumber)).toEqual([1, 5]);
  });

  it("lesson sync: optimistic concurrency + learner/tenant guards", async () => {
    const run = "lr-sync-1";
    // first write requires baseVersion 0
    const stale = await putLessonSyncState({
      lessonRunId: run,
      tenantId: T,
      learnerId: "lrn-a",
      baseVersion: 7,
      state: { a: 1 },
      deviceId: "dev-1",
    });
    expect(stale.ok).toBe(false);

    const first = await putLessonSyncState({
      lessonRunId: run,
      tenantId: T,
      learnerId: "lrn-a",
      baseVersion: 0,
      state: { a: 1 },
      deviceId: "dev-1",
    });
    expect(first.ok).toBe(true);
    expect(first.ok && first.state.version).toBe(1);

    // stale baseVersion is rejected, returns current
    const conflict = await putLessonSyncState({
      lessonRunId: run,
      tenantId: T,
      learnerId: "lrn-a",
      baseVersion: 0,
      state: { a: 2 },
      deviceId: "dev-2",
    });
    expect(conflict.ok).toBe(false);
    expect(!conflict.ok && conflict.current?.version).toBe(1);

    // correct version advances
    const second = await putLessonSyncState({
      lessonRunId: run,
      tenantId: T,
      learnerId: "lrn-a",
      baseVersion: 1,
      state: { a: 3 },
      deviceId: "dev-2",
    });
    expect(second.ok && second.state.version).toBe(2);

    // cross-learner write to the same run is refused
    const crossLearner = await putLessonSyncState({
      lessonRunId: run,
      tenantId: T,
      learnerId: "lrn-b",
      baseVersion: 2,
      state: { a: 9 },
      deviceId: "dev-3",
    });
    expect(crossLearner.ok).toBe(false);

    // read is tenant-scoped
    expect((await getLessonSyncState(run, T))?.version).toBe(2);
    expect(await getLessonSyncState(run, "t_wrong")).toBeNull();
  });
});
