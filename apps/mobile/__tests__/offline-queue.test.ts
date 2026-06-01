import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  makeItem,
  enqueue,
  loadQueue,
  flushQueue,
  dropStale,
  MAX_AGE_MS,
  type QueueItem,
} from "../lib/offline-queue";

// Hoisted so the vi.mock factories below can reference them.
const { mem, apiFetch } = vi.hoisted(() => ({
  mem: new Map<string, string>(),
  apiFetch: vi.fn(),
}));

// In-memory AsyncStorage stand-in.
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => mem.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: async (k: string) => {
      mem.delete(k);
    },
  },
}));

// Fake apiFetch — records calls and returns a configurable status.
vi.mock("../lib/api", () => ({ apiFetch }));

beforeEach(() => {
  mem.clear();
  apiFetch.mockReset();
  apiFetch.mockResolvedValue({ status: 200 });
});

describe("makeItem", () => {
  it("stamps an idempotency key + timestamp and JSON-encodes the body", () => {
    const item = makeItem("answer", "http://svc", "/a", "POST", { x: 1 });
    expect(item.idempotencyKey).toMatch(/.+-.+/);
    expect(item.body).toBe('{"x":1}');
    expect(item.method).toBe("POST");
    expect(typeof item.queuedAt).toBe("number");
  });

  it("keeps a null body for bodyless requests", () => {
    expect(makeItem("revoke", "http://svc", "/a", "POST", undefined).body).toBeNull();
  });
});

describe("persistence", () => {
  it("enqueue survives a reload (loadQueue reads it back)", async () => {
    await enqueue(makeItem("a", "http://svc", "/1", "POST", { n: 1 }));
    await enqueue(makeItem("b", "http://svc", "/2", "POST", { n: 2 }));
    const reloaded = await loadQueue();
    expect(reloaded.map((i) => i.action)).toEqual(["a", "b"]);
  });
});

describe("dropStale", () => {
  it("removes items older than the max age", () => {
    const now = 10 * MAX_AGE_MS;
    const fresh = { queuedAt: now - 1000 } as QueueItem;
    const stale = { queuedAt: now - MAX_AGE_MS - 1000 } as QueueItem;
    expect(dropStale([fresh, stale], now)).toEqual([fresh]);
  });
});

describe("flushQueue", () => {
  it("replays each item via apiFetch with an Idempotency-Key header and drains on success", async () => {
    await enqueue(makeItem("a", "http://svc", "/1", "POST", { n: 1 }));
    await enqueue(makeItem("b", "http://svc", "/2", "PUT", { n: 2 }));

    const pending = await flushQueue();
    expect(pending).toBe(0);
    expect(apiFetch).toHaveBeenCalledTimes(2);
    const opts = apiFetch.mock.calls[0][2] as { headers: Record<string, string> };
    expect(opts.headers["Idempotency-Key"]).toBeTruthy();
    expect(await loadQueue()).toEqual([]);
  });

  it("stops on a 5xx and keeps the failed + later items in order", async () => {
    await enqueue(makeItem("a", "http://svc", "/1", "POST", {}));
    await enqueue(makeItem("b", "http://svc", "/2", "POST", {}));
    await enqueue(makeItem("c", "http://svc", "/3", "POST", {}));
    apiFetch.mockResolvedValueOnce({ status: 200 }).mockResolvedValueOnce({ status: 503 });

    const pending = await flushQueue();
    expect(pending).toBe(2); // b (failed) + c (not attempted)
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect((await loadQueue()).map((i) => i.action)).toEqual(["b", "c"]);
  });

  it("consumes (drops) a 4xx so a poison item can't block the queue", async () => {
    await enqueue(makeItem("a", "http://svc", "/1", "POST", {}));
    apiFetch.mockResolvedValueOnce({ status: 400 });
    expect(await flushQueue()).toBe(0);
    expect(await loadQueue()).toEqual([]);
  });

  it("keeps the item on a network throw", async () => {
    await enqueue(makeItem("a", "http://svc", "/1", "POST", {}));
    apiFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await flushQueue()).toBe(1);
  });
});
