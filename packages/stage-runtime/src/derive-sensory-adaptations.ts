/**
 * Pure sensory-adaptation derivation — no React, no fetch, no DOM.
 *
 * `useSensoryAdapter` (and any server component) delegates here so the
 * profile→adaptation math is unit-testable and the same on every surface.
 * The web lesson player feeds the result through `sensoryCSSVars()` onto its
 * root element; canvas experiences read `--stage-animation-speed` from the
 * cascade. Composition rule: the global sensory MODE (standard/calm/
 * high-contrast → `--aivo-sensory-motionScale` 1/0.5/0) multiplies on top of
 * the per-learner PROFILE — the calmer of the two always wins.
 */
import type { SensoryProfile, SensoryAdaptations, FunctioningLevel } from "@aivo/stage-ui";

export const DEFAULT_SENSORY_PROFILE: SensoryProfile = {
  visual: "typical",
  auditory: "typical",
  tactile: "typical",
  vestibular: "typical",
  proprioceptive: "typical",
};

export const DEFAULT_SENSORY_ADAPTATIONS: SensoryAdaptations = {
  colorSaturation: 100,
  animationSpeed: 1,
  volumeLevel: 0.7,
  maxOnScreenElements: 6,
  useSubtitles: false,
  hapticIntensity: "standard",
  motionReduced: false,
  contrastBoost: false,
  boldOutlines: false,
  pulseAttention: false,
};

export interface DeriveSensoryOptions {
  functioningLevel?: FunctioningLevel;
  /**
   * Global sensory-mode multiplier (`--aivo-sensory-motionScale`):
   * standard = 1, calm = 0.5, high-contrast = 0. Clamped to [0, 1].
   * 0 forces `motionReduced` and zeroes `animationSpeed`.
   */
  motionScale?: number;
}

export function deriveSensoryAdaptations(
  profile: SensoryProfile | null | undefined,
  opts: DeriveSensoryOptions = {},
): SensoryAdaptations {
  const p = profile ?? DEFAULT_SENSORY_PROFILE;
  const level = opts.functioningLevel ?? "STANDARD";
  const a = { ...DEFAULT_SENSORY_ADAPTATIONS };

  if (p.visual === "hyper") {
    a.colorSaturation = 70;
    a.maxOnScreenElements = 3;
    a.boldOutlines = false;
    a.contrastBoost = false;
  } else if (p.visual === "hypo") {
    a.colorSaturation = 120;
    a.contrastBoost = true;
    a.boldOutlines = true;
    a.pulseAttention = true;
  }

  if (p.auditory === "hyper") {
    a.volumeLevel = 0.4;
    a.useSubtitles = true;
  } else if (p.auditory === "hypo") {
    a.volumeLevel = 1.0;
  }

  if (p.vestibular === "hyper" || p.proprioceptive === "hyper") {
    a.motionReduced = true;
    a.animationSpeed = 0.5;
  }

  if (p.tactile === "hyper") {
    a.hapticIntensity = "light";
  } else if (p.tactile === "hypo") {
    a.hapticIntensity = "standard";
  }

  if (level === "LOW_VERBAL" || level === "NON_VERBAL" || level === "PRE_SYMBOLIC") {
    a.maxOnScreenElements = Math.min(a.maxOnScreenElements, 3);
    a.useSubtitles = true;
    a.animationSpeed = Math.min(a.animationSpeed, 0.7);
  }

  if (level === "SUPPORTED") {
    a.maxOnScreenElements = Math.min(a.maxOnScreenElements, 4);
  }

  if (opts.motionScale != null) {
    const scale = Math.min(1, Math.max(0, opts.motionScale));
    a.animationSpeed = a.animationSpeed * scale;
    if (scale === 0) {
      a.animationSpeed = 0;
      a.motionReduced = true;
    }
  }

  return a;
}

/**
 * CSS custom properties for a stage root element. Plain strings so they can
 * be spread into a React `style` prop (server- and client-safe) or applied
 * with `element.style.setProperty`.
 */
export function sensoryCSSVars(a: SensoryAdaptations): Record<string, string> {
  return {
    "--stage-saturation": `${a.colorSaturation}%`,
    "--stage-animation-speed": `${a.animationSpeed}`,
    "--stage-transition-duration": a.animationSpeed === 0 ? "0ms" : `${300 / a.animationSpeed}ms`,
    "--stage-volume": `${a.volumeLevel}`,
    "--stage-max-elements": `${a.maxOnScreenElements}`,
  };
}

/**
 * DAPE regulation-break suggester. Maps the dominant sensory pattern to the
 * movement break most likely to re-regulate: seekers → heavy work /
 * proprioceptive input; avoiders → quiet vestibular.
 */
export function deriveRegulationBreak(profile: SensoryProfile | null | undefined): {
  profile: "seeker" | "avoider" | "any";
  category: "heavy_work" | "vestibular" | "balance";
} {
  const p = profile ?? DEFAULT_SENSORY_PROFILE;
  const seekerSignals = [
    p.proprioceptive === "hypo",
    p.vestibular === "hypo",
    p.tactile === "hypo",
  ].filter(Boolean).length;
  const avoiderSignals = [
    p.vestibular === "hyper",
    p.proprioceptive === "hyper",
    p.auditory === "hyper",
    p.visual === "hyper",
  ].filter(Boolean).length;
  if (seekerSignals > avoiderSignals) return { profile: "seeker", category: "heavy_work" };
  if (avoiderSignals > seekerSignals) return { profile: "avoider", category: "vestibular" };
  return { profile: "any", category: "balance" };
}

/**
 * Convert the web store's parent-curated profile
 * (`LearnerSensoryProfile.modalities`: keys include `proprioception`, values
 * `hyper | neutral | hypo | unknown`) into the stage contract
 * (`proprioceptive`, `hyper | typical | hypo`). Unknown/absent → typical.
 */
export function toStageSensoryProfile(
  modalities: Partial<Record<string, string>> | null | undefined,
): SensoryProfile {
  const norm = (v: string | undefined): "hyper" | "hypo" | "typical" =>
    v === "hyper" || v === "hypo" ? v : "typical";
  if (!modalities) return { ...DEFAULT_SENSORY_PROFILE };
  return {
    visual: norm(modalities.visual),
    auditory: norm(modalities.auditory),
    tactile: norm(modalities.tactile),
    vestibular: norm(modalities.vestibular),
    proprioceptive: norm(modalities.proprioceptive ?? modalities.proprioception),
  };
}

/**
 * Map the web store's lowercase functioning level onto the stage contract.
 * `alternative` (AAC/alternative communication) maps to LOW_VERBAL — the
 * stage treatment (picture-first, capped density, subtitles) matches that
 * support need. Unknown/absent → STANDARD.
 */
export function toStageFunctioningLevel(level: string | null | undefined): FunctioningLevel {
  switch (level) {
    case "supported":
      return "SUPPORTED";
    case "alternative":
      return "LOW_VERBAL";
    case "non_verbal":
      return "NON_VERBAL";
    case "pre_symbolic":
      return "PRE_SYMBOLIC";
    case "STANDARD":
    case "SUPPORTED":
    case "LOW_VERBAL":
    case "NON_VERBAL":
    case "PRE_SYMBOLIC":
      return level;
    default:
      return "STANDARD";
  }
}
