/**
 * Sprint 9 — idempotency cache unit tests.
 *
 * Pure-JS module; no IndexedDB / DOM. Pins the dedup contract so a
 * replayed lesson-run step never double-records on the server.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  __resetIdempotencyCacheForTests,
  readIdempotencyCache,
  writeIdempotencyCache,
  readIdempotencyKey,
} from "./idempotency";

describe("idempotency cache", () => {
  beforeEach(() => {
    __resetIdempotencyCacheForTests();
  });

  it("returns null when no entry has been cached", () => {
    expect(readIdempotencyCache("t1", "/api/x", "key-1")).toBeNull();
  });

  it("round-trips a (tenant, route, key) entry", () => {
    writeIdempotencyCache("t1", "/api/lesson-step", "abc-123", { ok: true, ref: 42 }, 200);
    const cached = readIdempotencyCache("t1", "/api/lesson-step", "abc-123");
    expect(cached).toEqual({ body: { ok: true, ref: 42 }, status: 200 });
  });

  it("scopes by tenant (a hash collision across tenants must not leak)", () => {
    writeIdempotencyCache("tenant-A", "/api/x", "shared-key", { who: "A" }, 200);
    writeIdempotencyCache("tenant-B", "/api/x", "shared-key", { who: "B" }, 200);
    expect(readIdempotencyCache("tenant-A", "/api/x", "shared-key")?.body).toEqual({ who: "A" });
    expect(readIdempotencyCache("tenant-B", "/api/x", "shared-key")?.body).toEqual({ who: "B" });
  });

  it("scopes by route (same key on different endpoints is distinct)", () => {
    writeIdempotencyCache("t1", "/api/x", "k", { from: "x" }, 200);
    writeIdempotencyCache("t1", "/api/y", "k", { from: "y" }, 200);
    expect(readIdempotencyCache("t1", "/api/x", "k")?.body).toEqual({ from: "x" });
    expect(readIdempotencyCache("t1", "/api/y", "k")?.body).toEqual({ from: "y" });
  });
});

describe("readIdempotencyKey", () => {
  function mkReq(headers: Record<string, string>): Request {
    return new Request("https://example.com/", { headers });
  }

  it("returns the header when present (lower-case)", () => {
    expect(readIdempotencyKey(mkReq({ "idempotency-key": "abcd1234" }))).toBe("abcd1234");
  });

  it("returns the header when present (canonical case)", () => {
    expect(readIdempotencyKey(mkReq({ "Idempotency-Key": "abcd1234" }))).toBe("abcd1234");
  });

  it("returns null for missing or malformed headers", () => {
    expect(readIdempotencyKey(mkReq({}))).toBeNull();
    expect(readIdempotencyKey(mkReq({ "idempotency-key": "short" }))).toBeNull(); // <8
    expect(readIdempotencyKey(mkReq({ "idempotency-key": "x".repeat(200) }))).toBeNull(); // >128
    expect(readIdempotencyKey(mkReq({ "idempotency-key": "has|pipe-bad" }))).toBeNull();
    expect(readIdempotencyKey(mkReq({ "idempotency-key": "has\x01control" }))).toBeNull();
  });

  it("trims whitespace", () => {
    expect(readIdempotencyKey(mkReq({ "idempotency-key": "  abcd1234  " }))).toBe("abcd1234");
  });
});
