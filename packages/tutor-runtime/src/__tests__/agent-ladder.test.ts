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
});
