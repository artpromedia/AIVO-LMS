import { describe, it, expect, vi } from "vitest";
import { HttpRosterWriter, RecordingRosterWriter } from "../pipeline/load.js";
import {
  encryptSisCredentials,
  decryptSisCredentials,
  redactCredentials,
} from "../lib/credentials.js";
import {
  backoffDelayMs,
  shouldRetry,
  retryRowJob,
  InMemorySyncQueue,
  DEFAULT_BACKOFF,
  type SyncJob,
} from "../queue/retry.js";

function okResponse(): Response {
  return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
}

describe("HttpRosterWriter", () => {
  const cfg = {
    identitySvcUrl: "https://identity",
    tenantSvcUrl: "https://tenant",
    serviceToken: "svc-tok",
    tenantId: "t1",
    provider: "oneroster",
  };

  it("routes users to identity-svc and orgs to tenant-svc", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url);
      return okResponse();
    });
    const w = new HttpRosterWriter(cfg, fetchImpl as unknown as typeof fetch);
    await w.upsert("users", { sourcedId: "u1" });
    await w.upsert("orgs", { sourcedId: "o1" });
    expect(calls[0]).toBe("https://identity/internal/roster/users/upsert");
    expect(calls[1]).toBe("https://tenant/internal/roster/orgs/upsert");
  });

  it("soft-deletes via the deactivate endpoint (never hard-delete)", async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    const w = new HttpRosterWriter(cfg, fetchImpl as unknown as typeof fetch);
    await w.softDelete("users", { sourcedId: "u1" }, "2026-01-01T00:00:00Z");
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://identity/internal/roster/users/deactivate");
    expect(JSON.parse(init.body as string).effectiveDate).toBe("2026-01-01T00:00:00Z");
  });

  it("throws on non-2xx so the row can be retried", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500 }) as unknown as Response);
    const w = new HttpRosterWriter(cfg, fetchImpl as unknown as typeof fetch);
    await expect(w.upsert("users", { sourcedId: "u1" })).rejects.toThrow(/failed: 500/);
  });

  it("RecordingRosterWriter captures ops without network", async () => {
    const w = new RecordingRosterWriter();
    await w.upsert("classes", { sourcedId: "c1" });
    await w.softDelete("users", { sourcedId: "u1" });
    expect(w.ops).toEqual([
      { op: "upsert", kind: "classes", sourcedId: "c1" },
      { op: "softDelete", kind: "users", sourcedId: "u1" },
    ]);
  });
});

describe("SIS credential envelope encryption", () => {
  it("round-trips secrets and never stores plaintext", () => {
    const stored = encryptSisCredentials({
      clientId: "abc123def456",
      clientSecret: "super-secret-value",
      tokenUrl: "https://idp/token",
    });
    expect(stored.clientSecretEnvelope).toBeTruthy();
    expect(JSON.stringify(stored)).not.toContain("super-secret-value");
    expect(stored.hint).toMatch(/client_id ····/);
    const back = decryptSisCredentials(stored);
    expect(back.clientSecret).toBe("super-secret-value");
    expect(back.clientId).toBe("abc123def456");
  });

  it("redacts secret-bearing keys for logging", () => {
    const safe = redactCredentials({
      clientId: "id",
      clientSecret: "s3cr3t",
      nested: { cleverToken: "tok" },
    });
    expect(safe.clientSecret).toBe("[REDACTED]");
    expect((safe.nested as Record<string, unknown>).cleverToken).toBe("[REDACTED]");
    expect(safe.clientId).toBe("id");
  });
});

describe("retry / backoff", () => {
  it("grows exponentially and respects the ceiling", () => {
    const mid = () => 0.5; // no jitter offset
    expect(backoffDelayMs(1, DEFAULT_BACKOFF, mid)).toBe(1000);
    expect(backoffDelayMs(2, DEFAULT_BACKOFF, mid)).toBe(2000);
    expect(backoffDelayMs(3, DEFAULT_BACKOFF, mid)).toBe(4000);
    expect(backoffDelayMs(20, DEFAULT_BACKOFF, mid)).toBe(DEFAULT_BACKOFF.maxMs);
  });

  it("applies bounded jitter", () => {
    const lo = backoffDelayMs(2, DEFAULT_BACKOFF, () => 0);
    const hi = backoffDelayMs(2, DEFAULT_BACKOFF, () => 1);
    expect(lo).toBe(1600); // 2000 - 20%
    expect(hi).toBe(2400); // 2000 + 20%
  });

  it("dead-letters after maxAttempts", () => {
    expect(shouldRetry(DEFAULT_BACKOFF.maxAttempts, DEFAULT_BACKOFF)).toBe(false);
    expect(shouldRetry(1, DEFAULT_BACKOFF)).toBe(true);
  });

  it("retryRowJob re-enqueues with backoff, then dead-letters", async () => {
    const q = new InMemorySyncQueue();
    const job: SyncJob = {
      type: "sync.row",
      tenantId: "t",
      connectorId: "c",
      attempt: 1,
      row: { kind: "users", sourcedId: "u1" },
    };
    const delay = await retryRowJob(q, job, DEFAULT_BACKOFF, () => 0.5);
    expect(delay).toBe(2000);
    expect(q.jobs[0].job.attempt).toBe(2);
    const dead = await retryRowJob(
      q,
      { ...job, attempt: DEFAULT_BACKOFF.maxAttempts },
      DEFAULT_BACKOFF,
    );
    expect(dead).toBeNull();
  });
});
