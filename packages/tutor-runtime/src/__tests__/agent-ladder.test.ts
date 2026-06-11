/**
 * Wave E (S8) — degradation ladder rules: every trigger drops exactly one
 * rung (envelope goes straight to deterministic), drops are sticky, and
 * consultation honours the rung.
 */
import { describe, expect, it, vi } from "vitest";
import { AgentLadder, nextRungDown, p95 } from "../agent-ladder.js";

describe("p95 / nextRungDown", () => {
  it("computes p95 on small windows and walks the rung order", () => {
    expect(p95([])).toBe(0);
    expect(p95([100])).toBe(100);
    expect(p95([100, 200, 300, 400, 5000])).toBe(5000);
    expect(nextRungDown("full")).toBe("checkpoint");
    expect(nextRungDown("checkpoint")).toBe("deterministic");
    expect(nextRungDown("deterministic")).toBe("deterministic");
  });
});

describe("AgentLadder", () => {
  it("drops one rung on a sustained latency breach and alerts once", () => {
    const onDrop = vi.fn();
    const ladder = new AgentLadder({ onDrop });
    for (let i = 0; i < 4; i++) ladder.recordTurn(2000);
    expect(ladder.current()).toBe("checkpoint");
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop.mock.calls[0]![0]).toMatchObject({
      from: "full",
      to: "checkpoint",
      trigger: "latency_budget",
    });
  });

  it("drops on consecutive failures and stays sticky (no climb back)", () => {
    const onDrop = vi.fn();
    const ladder = new AgentLadder({ onDrop });
    ladder.recordFailure("fallback:gateway_error");
    expect(ladder.current()).toBe("full"); // one failure is tolerated
    ladder.recordFailure("fallback:gateway_error");
    expect(ladder.current()).toBe("checkpoint");
    // A success does NOT climb back up.
    ladder.recordTurn(100);
    expect(ladder.current()).toBe("checkpoint");
    // Two more failures land on the floor.
    ladder.recordFailure("x");
    ladder.recordFailure("x");
    expect(ladder.current()).toBe("deterministic");
    expect(onDrop).toHaveBeenCalledTimes(2);
  });

  it("envelope exhaustion goes straight to deterministic", () => {
    const onDrop = vi.fn();
    const ladder = new AgentLadder({ onDrop });
    ladder.recordEnvelopeExhausted();
    expect(ladder.current()).toBe("deterministic");
    expect(onDrop.mock.calls[0]![0]).toMatchObject({
      from: "full",
      to: "deterministic",
      trigger: "envelope_exhausted",
    });
    // Already on the floor — no second alert.
    ladder.recordEnvelopeExhausted();
    expect(onDrop).toHaveBeenCalledTimes(1);
  });

  it("consultation honours the rung", () => {
    const ladder = new AgentLadder();
    expect(ladder.shouldConsult("other")).toBe(true);
    ladder.recordFailure("x");
    ladder.recordFailure("x"); // → checkpoint
    expect(ladder.shouldConsult("other")).toBe(false);
    expect(ladder.shouldConsult("check")).toBe(true);
    ladder.recordEnvelopeExhausted(); // → deterministic
    expect(ladder.shouldConsult("check")).toBe(false);
  });

  it("fast turns never drop the rung", () => {
    const onDrop = vi.fn();
    const ladder = new AgentLadder({ onDrop });
    for (let i = 0; i < 20; i++) ladder.recordTurn(300);
    expect(ladder.current()).toBe("full");
    expect(onDrop).not.toHaveBeenCalled();
  });

  // ── Wave E (S9): snapshot/restore across stateless turns ────────────────
  it("round-trips through snapshot/restore without losing trigger progress", () => {
    const ladder = new AgentLadder();
    ladder.recordTurn(2000);
    ladder.recordTurn(2000);
    ladder.recordFailure("one");
    const snap = ladder.snapshot();
    expect(snap).toEqual({
      rung: "full",
      latencies: [2000, 2000],
      consecutiveFailures: 1,
    });

    // The restored ladder continues exactly where the persisted one left
    // off: one more failure completes the streak and drops the rung …
    const restored = AgentLadder.restore(snap);
    restored.recordFailure("two");
    expect(restored.current()).toBe("checkpoint");

    // … and the latency window carries over: two more slow turns reach
    // the 4-sample minimum and breach p95.
    const restored2 = AgentLadder.restore(snap);
    restored2.recordTurn(2000);
    restored2.recordTurn(2000);
    expect(restored2.current()).toBe("checkpoint");
  });

  it("restore tolerates malformed snapshots by starting fresh", () => {
    expect(AgentLadder.restore(null).current()).toBe("full");
    expect(AgentLadder.restore({} as never).current()).toBe("full");
    expect(
      AgentLadder.restore({
        rung: "warp" as never,
        latencies: [-5, "x" as never, 100],
        consecutiveFailures: -3,
      }).current(),
    ).toBe("full");
    const sanitised = AgentLadder.restore({ latencies: [-5, "x" as never, 100] }).snapshot();
    expect(sanitised.latencies).toEqual([100]);
    expect(sanitised.consecutiveFailures).toBe(0);
  });

  it("restore preserves a sticky deterministic rung", () => {
    const ladder = AgentLadder.restore({
      rung: "deterministic",
      latencies: [],
      consecutiveFailures: 0,
    });
    expect(ladder.current()).toBe("deterministic");
    expect(ladder.shouldConsult("check")).toBe(false);
  });
});
