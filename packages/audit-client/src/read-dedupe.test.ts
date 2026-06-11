import { describe, it, expect } from "vitest";
import { createReadDedupe, READ_DEDUPE_WINDOW_MS } from "./read-dedupe.js";

describe("createReadDedupe", () => {
  it("emits the first read and suppresses repeats inside the window", () => {
    let t = 0;
    const dedupe = createReadDedupe({ now: () => t });
    expect(dedupe.shouldEmit("admin1", "admin.user.viewed", "user", "u9")).toBe(true);
    t += 1_000;
    expect(dedupe.shouldEmit("admin1", "admin.user.viewed", "user", "u9")).toBe(false);
    t += READ_DEDUPE_WINDOW_MS; // past the window from the FIRST emit
    expect(dedupe.shouldEmit("admin1", "admin.user.viewed", "user", "u9")).toBe(true);
  });

  it("a suppressed read does not extend the window (no permanent silence)", () => {
    let t = 0;
    const dedupe = createReadDedupe({ windowMs: 100, now: () => t });
    expect(dedupe.shouldEmit("a", "admin.user.viewed", "user", "r")).toBe(true);
    for (t = 10; t < 100; t += 10) {
      expect(dedupe.shouldEmit("a", "admin.user.viewed", "user", "r")).toBe(false);
    }
    t = 100;
    expect(dedupe.shouldEmit("a", "admin.user.viewed", "user", "r")).toBe(true);
  });

  it("keys are scoped per actor, action, and resource", () => {
    const t = 0;
    const dedupe = createReadDedupe({ now: () => t });
    expect(dedupe.shouldEmit("a1", "admin.user.viewed", "user", "r1")).toBe(true);
    expect(dedupe.shouldEmit("a2", "admin.user.viewed", "user", "r1")).toBe(true);
    expect(dedupe.shouldEmit("a1", "admin.learner.viewed", "learner", "r1")).toBe(true);
    expect(dedupe.shouldEmit("a1", "admin.user.viewed", "user", "r2")).toBe(true);
    expect(dedupe.shouldEmit("a1", "admin.user.viewed", "user", "r1")).toBe(false);
  });

  it("evicts oldest entries past maxEntries (memory bound)", () => {
    let t = 0;
    const dedupe = createReadDedupe({ maxEntries: 2, now: () => t });
    dedupe.shouldEmit("a", "admin.user.viewed", "user", "1");
    t = 1;
    dedupe.shouldEmit("a", "admin.user.viewed", "user", "2");
    t = 2;
    dedupe.shouldEmit("a", "admin.user.viewed", "user", "3"); // evicts "1"
    expect(dedupe.size()).toBe(2);
    t = 3;
    // "1" was evicted, so it emits again even though inside the window.
    expect(dedupe.shouldEmit("a", "admin.user.viewed", "user", "1")).toBe(true);
  });

  it("reset clears all state", () => {
    const dedupe = createReadDedupe({ now: () => 0 });
    dedupe.shouldEmit("a", "x.y", "user", "1");
    dedupe.reset();
    expect(dedupe.size()).toBe(0);
    expect(dedupe.shouldEmit("a", "x.y", "user", "1")).toBe(true);
  });
});
