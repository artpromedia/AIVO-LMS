import { describe, expect, it, beforeEach } from "vitest";
import { checkComposeRateLimit, resetComposeRateLimitsForTest } from "./compose-rate-limit";

beforeEach(() => resetComposeRateLimitsForTest());

describe("checkComposeRateLimit", () => {
  it("allows up to the per-hour limit, then blocks with a retry hint", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) {
      expect(checkComposeRateLimit("t1", "u1", t0).ok).toBe(true);
    }
    const blocked = checkComposeRateLimit("t1", "u1", t0);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("isolates buckets per (tenant, user)", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) checkComposeRateLimit("t1", "u1", t0);
    // A different user is unaffected.
    expect(checkComposeRateLimit("t1", "u2", t0).ok).toBe(true);
    // Same user in a different tenant is unaffected.
    expect(checkComposeRateLimit("t2", "u1", t0).ok).toBe(true);
  });

  it("frees capacity once the window has passed", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) checkComposeRateLimit("t1", "u1", t0);
    expect(checkComposeRateLimit("t1", "u1", t0).ok).toBe(false);
    // One hour and one second later the window has rolled over.
    expect(checkComposeRateLimit("t1", "u1", t0 + 60 * 60 * 1000 + 1000).ok).toBe(true);
  });
});
