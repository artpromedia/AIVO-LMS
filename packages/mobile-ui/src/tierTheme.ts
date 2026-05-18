/**
 * Mobile-side mirror of the learner-ui age-tier theme. React Native cannot
 * use CSS variables, so this exposes the same three tier palettes as plain
 * JS objects + a React context, keyed off the same `gradeToTier` logic.
 *
 * Importing from a separate `@aivo/learner-ui/tokens` path would pull in
 * web-only React DOM code, so the tokens are duplicated here intentionally.
 * Keep the two files in sync — the canonical definitions live in
 * `packages/learner-ui/src/tokens/age-tiers.ts`.
 */

import React, { createContext, useContext, useMemo } from "react";

export type AgeTier = "EARLY" | "MIDDLE" | "HIGH";

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

export const TIER_THEMES_MOBILE: Record<AgeTier, TierThemeMobile> = {
  EARLY: {
    id: "EARLY",
    name: "Soft Meadow",
    tagline: "K–5 · picture-book daylight",
    nameKey: "early_name",
    taglineKey: "early_tagline",
    colors: {
      bg: "#FFFAEF",
      surface: "#FFFCF4",
      surfaceAlt: "#FBF1DE",
      primary: "#7C3AED",
      primarySoft: "#EDE3FE",
      accent: "#FFB700",
      text: "#292F3D",
      textSoft: "#5C5067",
      sky: "#EDE3FE",
      warm: "#F8C4A0",
      tabBar: "#FFFCF4",
      tabBarActive: "#7C3AED",
      tabBarInactive: "#9189A1",
      border: "#F0E4D2",
    },
    radius: { sm: 14, md: 22, lg: 32, pill: 999 },
    paceMultiplier: 1.5,
  },
  MIDDLE: {
    id: "MIDDLE",
    name: "Study Treehouse",
    tagline: "6–8 · Ghibli twilight discovery",
    nameKey: "middle_name",
    taglineKey: "middle_tagline",
    colors: {
      bg: "#1F1535",
      surface: "#2A1F4D",
      surfaceAlt: "#3A2D52",
      primary: "#7C3AED",
      primarySoft: "rgba(124, 58, 237, 0.2)",
      accent: "#FFB700",
      text: "#F5EBD8",
      textSoft: "#B89A72",
      sky: "#3F2D6E",
      warm: "#5D7A5C",
      tabBar: "#2A1F4D",
      // In the dark MIDDLE tier, gold reads as the active highlight more
      // accessibly than violet on violet-night. Brand identity is preserved
      // (violet stays as the canonical `primary`); this is a contrast-only
      // override for the tab indicator surface.
      tabBarActive: "#FFB700",
      tabBarInactive: "#B89A72",
      border: "#3A2D52",
    },
    radius: { sm: 10, md: 14, lg: 20, pill: 999 },
    paceMultiplier: 1.0,
  },
  HIGH: {
    id: "HIGH",
    name: "Focus Studio",
    tagline: "9–12 · editorial calm",
    nameKey: "high_name",
    taglineKey: "high_tagline",
    colors: {
      bg: "#F4EFE6",
      surface: "#FAF6EE",
      surfaceAlt: "#EDE6D6",
      primary: "#7C3AED",
      primarySoft: "#E5DBF5",
      accent: "#FFB700",
      text: "#292F3D",
      textSoft: "#5C5067",
      sky: "#E5DBF5",
      warm: "#FFE08A",
      tabBar: "#FAF6EE",
      tabBarActive: "#7C3AED",
      tabBarInactive: "#9189A1",
      border: "#E5DBF5",
    },
    radius: { sm: 8, md: 10, lg: 16, pill: 999 },
    paceMultiplier: 0.8,
  },
};

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
