import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast-guard.js";
import { getSteadySignalDataset, resolveSteadySignal } from "./steady-signal.js";

describe("Steady Signal", () => {
  it("keeps primary actions readable in every appearance mode", () => {
    for (const appearance of ["light", "dark", "high-contrast"] as const) {
      const { colors } = resolveSteadySignal({ appearance });
      expect(contrastRatio(colors.signal, colors.signalOn)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps body text readable in every appearance mode", () => {
    for (const appearance of ["light", "dark", "high-contrast"] as const) {
      const { colors } = resolveSteadySignal({ appearance });
      expect(contrastRatio(colors.ink, colors.surface)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(colors.inkMuted, colors.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("resolves independent adaptivity axes without per-screen branching", () => {
    const theme = resolveSteadySignal({
      appearance: "dark",
      sensory: "calm",
      age: "early",
      communication: "symbol-first",
      role: "learner",
    });

    expect(theme.sensory.motionScale).toBe(0);
    expect(theme.age.minTouchTarget).toBe("64px");
    expect(theme.communication.aacDock).toBe("persistent");
    expect(getSteadySignalDataset(theme.selection)["data-ss-appearance"]).toBe("dark");
  });
});
