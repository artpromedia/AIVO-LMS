/**
 * Mobile-side age-tier theme. React Native cannot use CSS variables, so
 * this exposes the tier palettes as plain JS objects + a React context,
 * keyed off the same `gradeToTier` logic as the web.
 *
 * Sprint B7: the palettes come from the SINGLE token source —
 * packages/brand/tokens/modes/tier-themes.json (generated TS) — shared
 * with learner-ui, so web and mobile can never drift again. Only the
 * tier-resolution logic is mirrored here (importing learner-ui would
 * pull web-only DOM code into the native bundle).
 */

import React, { createContext, useContext, useMemo } from "react";
import { TIER_THEME_DATA, type AgeTierId } from "@aivo/brand";

export type AgeTier = AgeTierId;

export interface TierThemeMobile {
  id: AgeTier;
  name: string;
  tagline: string;
  /** i18n key under the `tier` namespace for the localised display name. */
  nameKey: string;
  /** i18n key under the `tier` namespace for the localised tagline. */
  taglineKey: string;
  colors: {
    bg: string;
    surface: string;
    surfaceAlt: string;
    primary: string;
    primarySoft: string;
    accent: string;
    text: string;
    textSoft: string;
    sky: string;
    warm: string;
    /** Tab bar background derived per tier so navigation feels native. */
    tabBar: string;
    /** Active tab tint */
    tabBarActive: string;
    /** Inactive tab tint */
    tabBarInactive: string;
    /** Border separator colour appropriate for the tier surface */
    border: string;
  };
  radius: { sm: number; md: number; lg: number; pill: number };
  paceMultiplier: number;
}

export const TIER_THEMES_MOBILE: Record<AgeTier, TierThemeMobile> = Object.fromEntries(
  (Object.keys(TIER_THEME_DATA) as AgeTier[]).map((tier) => {
    const data = TIER_THEME_DATA[tier];
    return [
      tier,
      {
        id: data.id,
        name: data.name,
        tagline: data.tagline,
        nameKey: data.nameKey,
        taglineKey: data.taglineKey,
        colors: { ...data.colors, ...data.mobile },
        radius: { ...data.radius },
        paceMultiplier: data.paceMultiplier,
      } satisfies TierThemeMobile,
    ];
  }),
) as Record<AgeTier, TierThemeMobile>;

/**
 * Mirror of `gradeToTier` from learner-ui — duplicated to keep mobile-ui
 * free of any web/DOM imports. See note at top of file.
 */
export function gradeToTier(gradeLevel: string | number | null | undefined): AgeTier {
  if (gradeLevel === null || gradeLevel === undefined) return "EARLY";
  const raw = String(gradeLevel).trim().toLowerCase();
  if (!raw) return "EARLY";
  if (raw === "pk" || raw === "pre-k" || raw === "prek" || raw.startsWith("pre")) return "EARLY";
  if (raw === "k" || raw.startsWith("kinder")) return "EARLY";
  const match = raw.match(/-?\d+/);
  if (!match) return "EARLY";
  const n = parseInt(match[0], 10);
  if (Number.isNaN(n)) return "EARLY";
  if (n <= 5) return "EARLY";
  if (n <= 8) return "MIDDLE";
  return "HIGH";
}

export function gradeToTheme(gradeLevel: string | number | null | undefined): TierThemeMobile {
  return TIER_THEMES_MOBILE[gradeToTier(gradeLevel)];
}

interface TierThemeContextValue {
  tier: AgeTier;
  theme: TierThemeMobile;
  gradeLevel: string | null;
}

const TierThemeContext = createContext<TierThemeContextValue | null>(null);

export interface TierThemeProviderProps {
  gradeLevel?: string | number | null;
  tier?: AgeTier;
  children: React.ReactNode;
}

export function TierThemeProvider({ gradeLevel, tier, children }: TierThemeProviderProps) {
  const value = useMemo<TierThemeContextValue>(() => {
    const resolved: AgeTier = tier ?? gradeToTier(gradeLevel ?? null);
    return {
      tier: resolved,
      theme: TIER_THEMES_MOBILE[resolved],
      gradeLevel: gradeLevel == null ? null : String(gradeLevel),
    };
  }, [tier, gradeLevel]);

  return React.createElement(TierThemeContext.Provider, { value }, children);
}

export function useTierTheme(): TierThemeContextValue {
  const ctx = useContext(TierThemeContext);
  if (!ctx) {
    // Soft fallback for screens that may render outside the provider
    // during cold-start / unauthenticated states.
    return {
      tier: "EARLY",
      theme: TIER_THEMES_MOBILE.EARLY,
      gradeLevel: null,
    };
  }
  return ctx;
}

export function useTierThemeOptional(): TierThemeContextValue | null {
  return useContext(TierThemeContext);
}
