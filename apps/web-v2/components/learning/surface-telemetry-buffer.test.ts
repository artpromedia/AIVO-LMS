/**
 * Vitest spec for the Sprint 1.3 surface-telemetry buffer.
 *
 * Tests run with a node-only fake fetch (no jsdom needed for this
 * module) — when `typeof window === "undefined"` the buffer just
 * skips the localStorage layer.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getTelemetryBuffer,
  __resetTelemetryBufferForTests,
  recordSurfaceTelemetry,
} from "@/components/learning/surface-telemetry-buffer";

describe("TelemetryBuffer", () => {
  beforeEach(() => {
    __resetTelemetryBufferForTests();
  });
  afterEach(() => {
    __resetTelemetryBufferForTests();
  });

  it("coalesces events and flushes within the debounce window", async () => {
    const calls: { url: string; body: string }[] = [];
    const fakeFetch: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), body: String(init?.body ?? "") });
      return new Response(null, { status: 204 });
    };
    const buffer = getTelemetryBuffer({ fetchImpl: fakeFetch, debounceMs: 20 });
    buffer.enqueue({
      learnerId: "lrn1",
      eventType: "impression",
      payload: { a: 1 },
    });
    buffer.enqueue({
      learnerId: "lrn1",
      eventType: "interaction",
      payload: { a: 2 },
    });
    expect(calls).toHaveLength(0);
    await new Promise((r) => setTimeout(r, 60));
    expect(calls).toHaveLength(1);
    const body = JSON.parse(calls[0].body) as { events: { eventType: string }[] };
    expect(body.events).toHaveLength(2);
    expect(body.events.map((e) => e.eventType)).toEqual(["impression", "interaction"]);
  });

  it("re-queues events on 5xx and retries with backoff", async () => {
    let attempt = 0;
    const fakeFetch: typeof fetch = async () => {
      attempt += 1;
      if (attempt === 1) return new Response(null, { status: 503 });
      return new Response(null, { status: 204 });
    };
    const buffer = getTelemetryBuffer({ fetchImpl: fakeFetch, debounceMs: 5 });
    buffer.enqueue({ learnerId: "lrn1", eventType: "completion" });
    await new Promise((r) => setTimeout(r, 50));
    // First attempt failed → buffer should retry. Force flush by waiting.
    await buffer.flush();
    expect(attempt).toBeGreaterThanOrEqual(2);
  });

  it("exposes `recordSurfaceTelemetry` convenience wrapper", () => {
    expect(() =>
      recordSurfaceTelemetry({ learnerId: "lrn1", eventType: "impression" }),
    ).not.toThrow();
  });
});
