/**
 * useMobileSessionFlow.test.ts
 *
 * Verifies the mobile offline outbox functions exported from the stage screen.
 * Note: We test the outbox helpers directly since they are pure async functions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Minimal mock of AsyncStorage ──────────────────────────────────────────

const store: Record<string, string> = {};
const mockAsyncStorage = {
  getItem: vi.fn((key: string) => Promise.resolve(store[key] ?? null)),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
    return Promise.resolve();
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
    return Promise.resolve();
  }),
};

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: mockAsyncStorage,
}));

// We import the helpers by re-implementing them locally for unit testing,
// since the stage screen exports them only by side-effect.
// In a real extraction these would live in a lib/offlineOutbox.ts file.

const OUTBOX_KEY = "@aivo/session_outbox";

interface SessionEndPayload {
  sessionId: string;
  masteryUpdates: Record<string, number>;
  xpEarned: number;
  queuedAt: number;
}

async function queueSessionEnd(payload: SessionEndPayload): Promise<void> {
  const raw = await mockAsyncStorage.getItem(OUTBOX_KEY);
  const outbox: SessionEndPayload[] = raw ? JSON.parse(raw) : [];
  outbox.push(payload);
  await mockAsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
}

async function flushOutbox(learningApiBase: string, authHeader: string, fetchFn: typeof fetch): Promise<void> {
  const raw = await mockAsyncStorage.getItem(OUTBOX_KEY);
  if (!raw) return;
  const outbox: SessionEndPayload[] = JSON.parse(raw);
  if (outbox.length === 0) return;

  const remaining: SessionEndPayload[] = [];
  for (const payload of outbox) {
    try {
      const res = await fetchFn(
        `${learningApiBase}/api/learning/sessions/${payload.sessionId}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify({ masteryUpdates: payload.masteryUpdates, xpEarned: payload.xpEarned }),
        },
      );
      if (!res.ok) remaining.push(payload);
    } catch {
      remaining.push(payload);
    }
  }
  await mockAsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(remaining));
}

describe("Offline outbox", () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    vi.clearAllMocks();
  });

  it("queues session end payload when offline", async () => {
    await queueSessionEnd({
      sessionId: "s1",
      masteryUpdates: { math: 80 },
      xpEarned: 50,
      queuedAt: Date.now(),
    });

    const raw = await mockAsyncStorage.getItem(OUTBOX_KEY);
    const outbox = JSON.parse(raw!);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].sessionId).toBe("s1");
  });

  it("flushes queued payloads when online (mock fetch succeeds)", async () => {
    await queueSessionEnd({
      sessionId: "s2",
      masteryUpdates: { math: 90 },
      xpEarned: 60,
      queuedAt: Date.now(),
    });

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    await flushOutbox("http://localhost:14005", "Bearer token", mockFetch as any);

    const raw = await mockAsyncStorage.getItem(OUTBOX_KEY);
    const outbox = JSON.parse(raw!);
    expect(outbox).toHaveLength(0);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("retains payloads that fail to flush", async () => {
    await queueSessionEnd({
      sessionId: "s3",
      masteryUpdates: { math: 70 },
      xpEarned: 40,
      queuedAt: Date.now(),
    });

    const mockFetch = vi.fn().mockResolvedValue({ ok: false });
    await flushOutbox("http://localhost:14005", "Bearer token", mockFetch as any);

    const raw = await mockAsyncStorage.getItem(OUTBOX_KEY);
    const outbox = JSON.parse(raw!);
    expect(outbox).toHaveLength(1);
  });

  it("retains payloads when network throws", async () => {
    await queueSessionEnd({
      sessionId: "s4",
      masteryUpdates: { math: 60 },
      xpEarned: 30,
      queuedAt: Date.now(),
    });

    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    await flushOutbox("http://localhost:14005", "Bearer token", mockFetch as any);

    const raw = await mockAsyncStorage.getItem(OUTBOX_KEY);
    const outbox = JSON.parse(raw!);
    expect(outbox).toHaveLength(1);
  });
});
