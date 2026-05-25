/**
 * Sprint 9 — outbox helper tests.
 *
 * IndexedDB itself is not in the Node vitest environment, so the
 * `enqueue/list/drain` paths are SSR-no-ops here and tested in
 * Playwright end-to-end (deferred to the e2e-coverage sprint). The
 * pure helpers — generateIdempotencyKey and the SSR-safe early returns
 * — are pinned here so a regression doesn't sneak through.
 */
import { describe, it, expect } from "vitest";
import {
  generateIdempotencyKey,
  enqueueOutbox,
  listOutbox,
  drainOutbox,
  clearOutbox,
  removeOutbox,
  registerOutboxAutoDrain,
} from "./outbox";

describe("generateIdempotencyKey", () => {
  it("produces a string", () => {
    expect(typeof generateIdempotencyKey()).toBe("string");
  });

  it("produces a unique value on every call", () => {
    const a = generateIdempotencyKey();
    const b = generateIdempotencyKey();
    expect(a).not.toBe(b);
  });

  it("supports a caller-supplied prefix", () => {
    const key = generateIdempotencyKey("lesson-step");
    expect(key.startsWith("lesson-step-")).toBe(true);
  });

  it("keys are within the BFF's accepted length window (8..128)", () => {
    for (let i = 0; i < 16; i++) {
      const k = generateIdempotencyKey();
      expect(k.length).toBeGreaterThanOrEqual(8);
      expect(k.length).toBeLessThanOrEqual(128);
    }
  });
});

describe("outbox SSR safety", () => {
  it("enqueueOutbox is a no-op in non-browser env", async () => {
    await expect(
      enqueueOutbox({
        id: "x",
        url: "/api/test",
        method: "POST",
        body: null,
        headers: {},
      }),
    ).resolves.toBeUndefined();
  });

  it("listOutbox returns [] in non-browser env", async () => {
    await expect(listOutbox()).resolves.toEqual([]);
  });

  it("drainOutbox reports a clean empty drain in non-browser env", async () => {
    await expect(drainOutbox()).resolves.toEqual({ drained: 0, failed: 0, records: [] });
  });

  it("clearOutbox / removeOutbox / registerOutboxAutoDrain do not throw", async () => {
    await expect(clearOutbox()).resolves.toBeUndefined();
    await expect(removeOutbox("ghost")).resolves.toBeUndefined();
    const unsub = registerOutboxAutoDrain();
    expect(typeof unsub).toBe("function");
    expect(() => unsub()).not.toThrow();
  });
});
