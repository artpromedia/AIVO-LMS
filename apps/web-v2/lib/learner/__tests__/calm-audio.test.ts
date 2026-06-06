/**
 * Calm audio cues — pure helpers + SSR/no-AudioContext safety.
 *
 * Runs in the default (node) vitest environment, so there is no `window`
 * and no AudioContext: every public method must be a safe no-op.
 */
import { describe, expect, it } from "vitest";
import {
  CALM_PHASE_FREQUENCIES,
  CALM_ENVELOPE,
  frequencyForPhase,
  calmEnvelope,
  createCalmChime,
} from "../calm-audio";
import { BOX_BREATH_PHASES, type BreathPhase } from "../calm";

describe("frequencyForPhase", () => {
  it("is total over every breath phase", () => {
    for (const phase of BOX_BREATH_PHASES) {
      expect(typeof frequencyForPhase(phase)).toBe("number");
      expect(frequencyForPhase(phase)).toBeGreaterThan(0);
    }
  });

  it("assigns a distinct pitch to each phase", () => {
    const freqs = BOX_BREATH_PHASES.map((p: BreathPhase) => frequencyForPhase(p));
    expect(new Set(freqs).size).toBe(freqs.length);
  });

  it("keeps frequencies in a soft, audible range", () => {
    for (const hz of Object.values(CALM_PHASE_FREQUENCIES)) {
      expect(hz).toBeGreaterThanOrEqual(100);
      expect(hz).toBeLessThanOrEqual(2000);
    }
  });
});

describe("calmEnvelope", () => {
  it("has gentle, click-free, low-gain parameters", () => {
    const env = calmEnvelope();
    expect(env).toEqual(CALM_ENVELOPE);
    expect(env.attackSeconds).toBeGreaterThan(0);
    expect(env.attackSeconds).toBeLessThan(0.5);
    expect(env.releaseSeconds).toBeGreaterThan(0);
    expect(env.releaseSeconds).toBeLessThanOrEqual(2);
    expect(env.peakGain).toBeGreaterThan(0);
    expect(env.peakGain).toBeLessThanOrEqual(0.3);
  });
});

describe("createCalmChime — no-op without an AudioContext", () => {
  it("never throws when window/AudioContext are unavailable", () => {
    expect(typeof window).toBe("undefined");
    const chime = createCalmChime();
    expect(() => {
      for (const phase of BOX_BREATH_PHASES) chime.phaseCue(phase);
      chime.dispose();
      // Safe to call again after dispose.
      chime.phaseCue("inhale");
      chime.dispose();
    }).not.toThrow();
  });
});
