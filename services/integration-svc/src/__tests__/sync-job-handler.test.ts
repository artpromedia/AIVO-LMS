/**
 * Sprint 2 — unit test for the real BullMQ worker handler.
 *
 * We use the InMemorySyncQueue as the retry sink so we can observe whether a
 * failing job is re-enqueued with backoff or dead-lettered. The db is a tiny
 * chainable stub returning the rows the handler asks for; runSyncInBackground
 * does network I/O so we don't run it directly — we instead exercise the
 * "no connection found" branch (real error path) and the "max attempts"
 * dead-letter branch.
 */
import { describe, it, expect } from "vitest";
import { createSyncJobHandler } from "../queue/sync-job-handler.js";
import { InMemorySyncQueue, DEFAULT_BACKOFF, type SyncJob } from "../queue/retry.js";

function makeDb(connectionRows: Array<{ id: string; status: string }>) {
  // Drizzle-shaped chainable: db.select().from(t).where(cond) -> array
  const select = () => ({
    from: () => ({
      where: () => Promise.resolve(connectionRows),
    }),
  });
  // Insert chain: db.insert(t).values(v).returning() -> [{id}]
  const insert = () => ({
    values: () => ({
      returning: () => Promise.resolve([{ id: "syncLog-1" }]),
    }),
  });
  return { select, insert };
}

function makeLogger() {
  const events: any[] = [];
  return {
    events,
    info: (m: any) => events.push({ level: "info", m }),
    warn: (m: any) => events.push({ level: "warn", m }),
    error: (m: any) => events.push({ level: "error", m }),
  };
}

const baseJob: SyncJob = {
  type: "sync.full",
  tenantId: "t-1",
  connectorId: "clever",
  attempt: 1,
};

describe("sync-job-handler", () => {
  it("re-enqueues with backoff when no connection is found", async () => {
    const db = makeDb([]); // no matching connection
    const queue = new InMemorySyncQueue();
    const logger = makeLogger();
    const handler = createSyncJobHandler({ db, queue, logger });

    await handler({ ...baseJob, attempt: 1 });

    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs[0].job.attempt).toBe(2);
    expect(queue.jobs[0].delayMs).toBeGreaterThan(0);
    const warn = logger.events.find((e) => e.level === "warn");
    expect(warn?.m?.msg).toBe("sync job retried");
  });

  it("dead-letters once maxAttempts is reached", async () => {
    const db = makeDb([]); // still no connection — will throw again
    const queue = new InMemorySyncQueue();
    const logger = makeLogger();
    const handler = createSyncJobHandler({ db, queue, logger });

    // attempt == maxAttempts means retryRowJob.next == maxAttempts+1 -> dead-letter
    await handler({ ...baseJob, attempt: DEFAULT_BACKOFF.maxAttempts });

    expect(queue.jobs).toHaveLength(0); // no re-enqueue
    const err = logger.events.find((e) => e.level === "error");
    expect(err?.m?.msg).toBe("sync job dead-lettered");
  });
});
