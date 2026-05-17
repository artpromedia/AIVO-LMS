/**
 * useSensoryAdapter — React hook that loads the learner's sensory profile
 * (visual / auditory / tactile / vestibular / proprioceptive) and derives
 * stage adaptations: color saturation, animation speed, max on-screen
 * elements, subtitles, haptic intensity, motion-reduction.
 *
 * Extracted from apps/web/src/components/stage/useSensoryAdapter.ts as part
 * of the §8 #2 Stage extraction (v2.1).
 */
"use client";
import { useCallback, useEffect, useState } from "react";
import type {
  CSSProperties,
} from "react";
import type {
  SensoryProfile,
  SensoryAdaptations,
  FunctioningLevel,
} from "@aivo/stage-ui";

const DEFAULT_PROFILE: SensoryProfile = {
  visual: "typical",
  auditory: "typical",
  tactile: "typical",
  vestibular: "typical",
  proprioceptive: "typical",
};

const DEFAULT_ADAPTATIONS: SensoryAdaptations = {
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

function computeAdaptations(profile: SensoryProfile, level: FunctioningLevel): SensoryAdaptations {
  const a = { ...DEFAULT_ADAPTATIONS };

  if (profile.visual === "hyper") {
    a.colorSaturation = 70;
    a.maxOnScreenElements = 3;
    a.boldOutlines = false;
    a.contrastBoost = false;
  } else if (profile.visual === "hypo") {
    a.colorSaturation = 120;
    a.contrastBoost = true;
    a.boldOutlines = true;
    a.pulseAttention = true;
  }

  if (profile.auditory === "hyper") {
    a.volumeLevel = 0.4;
    a.useSubtitles = true;
  } else if (profile.auditory === "hypo") {
    a.volumeLevel = 1.0;
  }

  if (profile.vestibular === "hyper" || profile.proprioceptive === "hyper") {
    a.motionReduced = true;
    a.animationSpeed = 0.5;
  }

  if (profile.tactile === "hyper") {
    a.hapticIntensity = "light";
  } else if (profile.tactile === "hypo") {
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

  return a;
}

export interface SensoryAdapterApi {
  profile: SensoryProfile;
  adaptations: SensoryAdaptations;
  loaded: boolean;
  getCSSVars: () => CSSProperties;
  getRegulationBreak: () => {
    profile: "seeker" | "avoider" | "any";
    category: "heavy_work" | "vestibular" | "balance";
  };
}

export function useSensoryAdapter(
  learnerId: string | null,
  accessToken: string | null,
  functioningLevel: FunctioningLevel = "STANDARD",
): SensoryAdapterApi {
  const [profile, setProfile] = useState<SensoryProfile>(DEFAULT_PROFILE);
  const [adaptations, setAdaptations] = useState<SensoryAdaptations>(DEFAULT_ADAPTATIONS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!learnerId || !accessToken) return;
    fetch(`/api/assessments/sensory-profile/${learnerId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.visual) {
          setProfile({
            visual: data.visual || "typical",
            auditory: data.auditory || "typical",
            tactile: data.tactile || "typical",
            vestibular: data.vestibular || "typical",
            proprioceptive: data.proprioceptive || "typical",
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [learnerId, accessToken]);

  useEffect(() => {
    setAdaptations(computeAdaptations(profile, functioningLevel));
  }, [profile, functioningLevel]);

  const getCSSVars = useCallback((): CSSProperties => ({
    "--stage-saturation": `${adaptations.colorSaturation}%`,
    "--stage-animation-speed": `${adaptations.animationSpeed}`,
    "--stage-transition-duration": `${300 / adaptations.animationSpeed}ms`,
  } as CSSProperties), [adaptations]);

  // DAPE regulation-break suggester. Maps the dominant sensory pattern to
  // the type of movement break most likely to bring the learner back into
  // a regulated state: seekers benefit from heavy work / proprioceptive
  // input; avoiders from quiet vestibular. Returns the DAPE category to
  // pull a break activity from.
  const getRegulationBreak = useCallback((): {
    profile: "seeker" | "avoider" | "any";
    category: "heavy_work" | "vestibular" | "balance";
  } => {
    const seekerSignals = [
      profile.proprioceptive === "hypo",
      profile.vestibular === "hypo",
      profile.tactile === "hypo",
    ].filter(Boolean).length;
    const avoiderSignals = [
      profile.vestibular === "hyper",
      profile.proprioceptive === "hyper",
      profile.auditory === "hyper",
      profile.visual === "hyper",
    ].filter(Boolean).length;
    if (seekerSignals > avoiderSignals) return { profile: "seeker", category: "heavy_work" };
    if (avoiderSignals > seekerSignals) return { profile: "avoider", category: "vestibular" };
    return { profile: "any", category: "balance" };
  }, [profile]);

  return { profile, adaptations, loaded, getCSSVars, getRegulationBreak };
}

// Re-export the pure derivation function for unit testing without React.
export { computeAdaptations as _computeSensoryAdaptations };
