/**
 * Adapter unit test — verify the BullMQ port honors the SyncQueue contract:
 *
 *  - `enqueue(job, delayMs)` forwards `delay`, `attempts: 1`, and the
 *    job payload to BullMQ's `Queue.add`.
 *  - `attempts` is pinned at 1 (retry policy lives in `retry.ts`, not in
 *    BullMQ's per-job retry machinery).
 *
 * We mock `bullmq` and `ioredis` to keep this hermetic — the goal is to
 * pin the adapter behavior, not to integration-test BullMQ itself.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const addMock = vi.fn(async () => undefined);
const closeMock = vi.fn(async () => undefined);

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation((name: string) => ({
    name,
    add: addMock,
    close: closeMock,
  })),
  Worker: vi.fn(),
}));

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation((url: string) => ({ url })),
}));

beforeEach(() => {
  addMock.mockClear();
  closeMock.mockClear();
});

describe("BullMqSyncQueue adapter", () => {
  it("forwards delayMs and pins attempts: 1", async () => {
    const { BullMqSyncQueue } = await import("../queue/bullmq-adapter.js");
    const q = new BullMqSyncQueue({} as any);
    const job = {
      type: "sync.row" as const,
      tenantId: "t1",
      connectorId: "c1",
      row: { kind: "user", sourcedId: "u1" },
      attempt: 2,
    };
    await q.enqueue(job, 7500);
    expect(addMock).toHaveBeenCalledTimes(1);
    const [type, payload, opts] = addMock.mock.calls[0] as any;
    expect(type).toBe("sync.row");
    expect(payload).toEqual(job);
    expect(opts.delay).toBe(7500);
    expect(opts.attempts).toBe(1);
    expect(opts.removeOnComplete).toBe(1000);
    expect(opts.removeOnFail).toBe(5000);
  });

  it("floors negative delays to 0", async () => {
    const { BullMqSyncQueue } = await import("../queue/bullmq-adapter.js");
    const q = new BullMqSyncQueue({} as any);
    await q.enqueue({ type: "sync.full", tenantId: "t1", connectorId: "c1", attempt: 1 }, -100);
    const [, , opts] = addMock.mock.calls[0] as any;
    expect(opts.delay).toBe(0);
  });

  it("createBullMqQueueFromEnv returns null when REDIS_URL is unset", async () => {
    const prev = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    try {
      const { createBullMqQueueFromEnv } = await import("../queue/bullmq-adapter.js");
      expect(createBullMqQueueFromEnv()).toBeNull();
    } finally {
      if (prev !== undefined) process.env.REDIS_URL = prev;
    }
  });
});
