/**
 * useSensoryAdapter — React hook that derives stage adaptations (color
 * saturation, animation speed, max on-screen elements, subtitles, haptic
 * intensity, motion-reduction) from a learner's sensory profile.
 *
 * Transport-free by design: the previous version fetched a hardcoded
 * assessment-svc URL that does not exist on the web origin, so the hook
 * could never load real data there. Callers now either pass the `profile`
 * they already have (the web lesson player loads it server-side through the
 * repos layer) or inject a `loadProfile` function that speaks whatever
 * transport the host app uses (BFF route on web, api client on mobile).
 *
 * All math lives in ./derive-sensory-adaptations.ts (pure, unit-tested).
 */
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { SensoryProfile, SensoryAdaptations, FunctioningLevel } from "@aivo/stage-ui";
import {
  DEFAULT_SENSORY_PROFILE,
  deriveRegulationBreak,
  deriveSensoryAdaptations,
  sensoryCSSVars,
} from "./derive-sensory-adaptations.js";

export interface UseSensoryAdapterOptions {
  /** Profile already loaded by the host (server component, query cache…). */
  profile?: SensoryProfile | null;
  /**
   * Async loader used when `profile` is not supplied. Resolve `null` when the
   * learner has no curated profile; reject/throw is treated the same way so
   * a failed read can never break the stage.
   */
  loadProfile?: () => Promise<SensoryProfile | null>;
  functioningLevel?: FunctioningLevel;
  /** Global sensory-mode multiplier — see DeriveSensoryOptions.motionScale. */
  motionScale?: number;
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

export function useSensoryAdapter(options: UseSensoryAdapterOptions = {}): SensoryAdapterApi {
  const { profile: providedProfile, loadProfile, functioningLevel = "STANDARD" } = options;
  const motionScale = options.motionScale;

  const [loadedProfile, setLoadedProfile] = useState<SensoryProfile | null>(null);
  const [loaded, setLoaded] = useState(providedProfile !== undefined || !loadProfile);

  useEffect(() => {
    if (providedProfile !== undefined || !loadProfile) return;
    let cancelled = false;
    loadProfile()
      .then((p) => {
        if (!cancelled && p) setLoadedProfile(p);
      })
      .catch(() => {
        // A missing/failed profile read must never break the stage — the
        // learner simply gets the neutral defaults.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [providedProfile, loadProfile]);

  const profile = providedProfile ?? loadedProfile ?? DEFAULT_SENSORY_PROFILE;

  const adaptations = useMemo(
    () => deriveSensoryAdaptations(profile, { functioningLevel, motionScale }),
    [profile, functioningLevel, motionScale],
  );

  const getCSSVars = useCallback(
    (): CSSProperties => sensoryCSSVars(adaptations) as CSSProperties,
    [adaptations],
  );

  const getRegulationBreak = useCallback(() => deriveRegulationBreak(profile), [profile]);

  return { profile, adaptations, loaded, getCSSVars, getRegulationBreak };
}
