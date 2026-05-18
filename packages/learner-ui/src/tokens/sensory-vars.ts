import type { FunctioningLevel, FlProfile } from "./fl-profiles";
import { FL_PROFILES } from "./fl-profiles";

export interface SensoryProfile {
  visual: "hyper" | "hypo" | "typical";
  auditory: "hyper" | "hypo" | "typical";
  tactile: "hyper" | "hypo" | "typical";
  vestibular: "hyper" | "hypo" | "typical";
  proprioceptive: "hyper" | "hypo" | "typical";
}

export interface SensoryVars {
  "--learner-base-font": string;
  "--learner-line-height": string;
  "--learner-letter-spacing": string;
  "--learner-hit-target": string;
  "--learner-motion-ms": string;
  "--learner-saturation": string;
  "--learner-max-concurrent-anim": string;
  "--learner-contrast-boost": string;
  "--learner-bold-outlines": string;
  "--learner-animation-speed": string;
  "--learner-volume": string;
}

export function computeSensoryVars(level: FunctioningLevel, sensory?: SensoryProfile): SensoryVars {
  const profile = FL_PROFILES[level];

  let saturation = 100;
  let contrastBoost = false;
  let boldOutlines = false;
  let animationSpeed = 1;
  let volume = 0.7;

  if (sensory) {
    if (sensory.visual === "hyper") {
      saturation = 70;
      boldOutlines = false;
    } else if (sensory.visual === "hypo") {
      saturation = 120;
      contrastBoost = true;
      boldOutlines = true;
    }

    if (sensory.auditory === "hyper") {
      volume = 0.4;
    } else if (sensory.auditory === "hypo") {
      volume = 1.0;
    }

    if (sensory.vestibular === "hyper" || sensory.proprioceptive === "hyper") {
      animationSpeed = 0.5;
    }
  }

  if (level === "PRE_SYMBOLIC") {
    saturation = Math.min(saturation, 70);
  }

  return {
    "--learner-base-font": `${profile.baseFontSize}px`,
    "--learner-line-height": `${profile.lineHeight}`,
    "--learner-letter-spacing": profile.letterSpacing,
    "--learner-hit-target": `${profile.hitTarget}px`,
    "--learner-motion-ms": `${profile.motionDuration}ms`,
    "--learner-saturation": `${saturation}%`,
    "--learner-max-concurrent-anim": `${profile.maxConcurrentAnimations}`,
    "--learner-contrast-boost": contrastBoost ? "1" : "0",
    "--learner-bold-outlines": boldOutlines ? "1" : "0",
    "--learner-animation-speed": `${animationSpeed}`,
    "--learner-volume": `${volume}`,
  };
}

export function writeSensoryVarsToRoot(vars: SensoryVars): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

export function clearSensoryVarsFromRoot(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const varNames: (keyof SensoryVars)[] = [
    "--learner-base-font",
    "--learner-line-height",
    "--learner-letter-spacing",
    "--learner-hit-target",
    "--learner-motion-ms",
    "--learner-saturation",
    "--learner-max-concurrent-anim",
    "--learner-contrast-boost",
    "--learner-bold-outlines",
    "--learner-animation-speed",
    "--learner-volume",
  ];
  for (const name of varNames) {
    root.style.removeProperty(name);
  }
}

export function sensoryVarsToCSS(vars: SensoryVars): string {
  return Object.entries(vars)
    .map(([key, value]) => `${key}: ${value};`)
    .join("\n");
}
