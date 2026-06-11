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


describe("Sprint A6 — session priority lane + legacy migration", () => {
  it("laneOrder replays session items before default items, order preserved", async () => {
    const { laneOrder, makeItem } = await import("../lib/offline-queue");
    const a = makeItem("a", "http://x", "/a", "POST", {});
    const s1 = makeItem("s1", "http://x", "/s1", "POST", {}, "session");
    const b = makeItem("b", "http://x", "/b", "POST", {});
    const s2 = makeItem("s2", "http://x", "/s2", "POST", {}, "session");
    expect(laneOrder([a, s1, b, s2]).map((i) => i.action)).toEqual(["s1", "s2", "a", "b"]);
  });

  it("migrates the legacy session outbox into the session lane exactly once", async () => {
    const { migrateLegacySessionOutbox, loadQueue } = await import("../lib/offline-queue");
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    await AsyncStorage.setItem(
      "@aivo/session_outbox",
      JSON.stringify([
        { sessionId: "sess_1", masteryUpdates: { math: 80 }, xpEarned: 25, queuedAt: 123 },
      ]),
    );
    const migrated = await migrateLegacySessionOutbox("http://learning.test");
    expect(migrated).toBe(1);
    const queue = await loadQueue();
    const item = queue.find((i) => i.action === "session.complete");
    expect(item).toBeTruthy();
    expect(item!.priority).toBe("session");
    expect(item!.path).toBe("/api/learning/sessions/sess_1/complete");
    expect(JSON.parse(item!.body!)).toEqual({ masteryUpdates: { math: 80 }, xpEarned: 25 });
    // second run is a no-op (key removed)
    expect(await migrateLegacySessionOutbox("http://learning.test")).toBe(0);
  });
});
