import { describe, expect, it } from "vitest";
import {
  DEFAULT_SENSORY_ADAPTATIONS,
  deriveRegulationBreak,
  deriveSensoryAdaptations,
  sensoryCSSVars,
  toStageSensoryProfile,
} from "../derive-sensory-adaptations.js";
import type { SensoryProfile } from "@aivo/stage-ui";

const profile = (over: Partial<SensoryProfile> = {}): SensoryProfile => ({
  visual: "typical",
  auditory: "typical",
  tactile: "typical",
  vestibular: "typical",
  proprioceptive: "typical",
  ...over,
});

describe("deriveSensoryAdaptations", () => {
  it("null profile → neutral defaults", () => {
    expect(deriveSensoryAdaptations(null)).toEqual(DEFAULT_SENSORY_ADAPTATIONS);
  });

  it("hyper-visual desaturates and reduces simultaneous elements", () => {
    const a = deriveSensoryAdaptations(profile({ visual: "hyper" }));
    expect(a.colorSaturation).toBeLessThanOrEqual(85);
    expect(a.maxOnScreenElements).toBeLessThanOrEqual(4);
  });

  it("hypo-visual boosts saturation, contrast and outlines", () => {
    const a = deriveSensoryAdaptations(profile({ visual: "hypo" }));
    expect(a.colorSaturation).toBeGreaterThanOrEqual(100);
    expect(a.contrastBoost).toBe(true);
    expect(a.boldOutlines).toBe(true);
  });

  it("hyper-auditory lowers volume and turns subtitles on", () => {
    const a = deriveSensoryAdaptations(profile({ auditory: "hyper" }));
    expect(a.volumeLevel).toBeLessThanOrEqual(0.4);
    expect(a.useSubtitles).toBe(true);
  });

  it("vestibular-hyper reduces motion and halves speed", () => {
    const a = deriveSensoryAdaptations(profile({ vestibular: "hyper" }));
    expect(a.motionReduced).toBe(true);
    expect(a.animationSpeed).toBe(0.5);
  });

  it("functioning level caps density and speed", () => {
    const a = deriveSensoryAdaptations(profile(), { functioningLevel: "NON_VERBAL" });
    expect(a.maxOnScreenElements).toBeLessThanOrEqual(3);
    expect(a.useSubtitles).toBe(true);
    expect(a.animationSpeed).toBeLessThanOrEqual(0.7);
  });

  it("motionScale composes multiplicatively; 0 hard-zeros and flags reduced", () => {
    const calm = deriveSensoryAdaptations(profile(), { motionScale: 0.5 });
    expect(calm.animationSpeed).toBe(0.5);
    const hc = deriveSensoryAdaptations(profile({ visual: "hypo" }), { motionScale: 0 });
    expect(hc.animationSpeed).toBe(0);
    expect(hc.motionReduced).toBe(true);
  });

  it("calmer-of-the-two wins: profile 0.5 × mode 0.5 = 0.25", () => {
    const a = deriveSensoryAdaptations(profile({ vestibular: "hyper" }), { motionScale: 0.5 });
    expect(a.animationSpeed).toBe(0.25);
  });
});

describe("sensoryCSSVars", () => {
  it("emits the stage var contract", () => {
    const vars = sensoryCSSVars(deriveSensoryAdaptations(profile({ visual: "hyper" })));
    expect(vars["--stage-saturation"]).toBe("70%");
    expect(vars["--stage-animation-speed"]).toBe("1");
    expect(vars["--stage-transition-duration"]).toBe("300ms");
    expect(vars["--stage-max-elements"]).toBe("3");
  });

  it("zero speed → 0ms duration (no divide-by-zero)", () => {
    const vars = sensoryCSSVars(deriveSensoryAdaptations(profile(), { motionScale: 0 }));
    expect(vars["--stage-animation-speed"]).toBe("0");
    expect(vars["--stage-transition-duration"]).toBe("0ms");
  });
});

describe("toStageSensoryProfile", () => {
  it("maps store keys/values onto the stage contract", () => {
    const p = toStageSensoryProfile({
      visual: "hyper",
      auditory: "neutral",
      tactile: "unknown",
      vestibular: "hypo",
      proprioception: "hyper",
    });
    expect(p).toEqual({
      visual: "hyper",
      auditory: "typical",
      tactile: "typical",
      vestibular: "hypo",
      proprioceptive: "hyper",
    });
  });

  it("null/absent → all typical", () => {
    expect(toStageSensoryProfile(null).visual).toBe("typical");
    expect(toStageSensoryProfile({}).proprioceptive).toBe("typical");
  });
});

describe("deriveRegulationBreak", () => {
  it("seeker pattern → heavy work; avoider → vestibular; balanced → balance", () => {
    expect(deriveRegulationBreak(profile({ proprioceptive: "hypo", tactile: "hypo" }))).toEqual({
      profile: "seeker",
      category: "heavy_work",
    });
    expect(deriveRegulationBreak(profile({ vestibular: "hyper", visual: "hyper" }))).toEqual({
      profile: "avoider",
      category: "vestibular",
    });
    expect(deriveRegulationBreak(profile())).toEqual({ profile: "any", category: "balance" });
  });
});
