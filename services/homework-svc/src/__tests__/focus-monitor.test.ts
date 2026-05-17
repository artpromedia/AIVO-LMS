import { describe, expect, it } from "vitest";
import { observeFocus } from "../services/focus-monitor.js";

describe("focus monitor", () => {
  it("reports focused when signals are nominal", () => {
    const obs = observeFocus({});
    expect(obs.state).toBe("focused");
  });

  it("flags frustration on high eraser count", () => {
    const obs = observeFocus({ eraserCount: 6 });
    expect(obs.state).toBe("frustrated");
    expect(obs.recommendedAction).toBe("switch_surface");
  });

  it("flags frustration on repeated wrong attempts", () => {
    const obs = observeFocus({ consecutiveWrongAttempts: 3 });
    expect(obs.state).toBe("frustrated");
    expect(obs.recommendedAction).toBe("simplify_step");
  });

  it("recommends a break on long inactivity", () => {
    const obs = observeFocus({ inactivityMs: 130_000 });
    expect(obs.state).toBe("needs_break");
    expect(obs.recommendedAction).toBe("offer_break");
  });

  it("recommends a micro hint when latency is high", () => {
    const obs = observeFocus({ latencyMs: 60_000 });
    expect(obs.state).toBe("needs_prompt");
    expect(obs.recommendedAction).toBe("micro_hint");
  });

  it("flags abandoned surface", () => {
    const obs = observeFocus({ abandonedSurface: true });
    expect(obs.state).toBe("needs_break");
  });
});
