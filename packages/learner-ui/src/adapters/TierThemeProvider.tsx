"use client";
import React, { createContext, useContext, useEffect, useMemo } from "react";
import {
  type AgeTier,
  type TierTheme,
  TIER_THEMES,
  gradeToTier,
  tierThemeToCssVars,
} from "../tokens/age-tiers";

interface TierThemeContextValue {
  tier: AgeTier;
  theme: TierTheme;
  /** The raw gradeLevel that produced this tier, useful for analytics. */
  gradeLevel: string | null;
}

const TierThemeContext = createContext<TierThemeContextValue | null>(null);

export interface TierThemeProviderProps {
  /**
   * Either a raw `gradeLevel` string (preferred — the tier will be derived,
   * giving you free auto-promotion when the learner advances grades) or an
   * explicit `tier` for previews/marketing pages.
   */
  gradeLevel?: string | number | null;
  tier?: AgeTier;
  /**
   * If true (default), CSS variables are written to `document.documentElement`
   * — appropriate at the root of the learner experience. Set false for nested
   * scoped use; the provider will instead write to its own wrapper element.
   */
  scopeToRoot?: boolean;
  children: React.ReactNode;
}

/**
 * Wraps the learner experience and exposes the active age-tier theme as
 *
 *   1. A set of `--tier-*` CSS variables on `:root` (or this provider's
 *      wrapper if `scopeToRoot={false}`), so any descendant — including
 *      legacy components that don't read context — can use the tier
 *      palette via `var(--tier-primary)` etc.
 *   2. A React context for components that need conditional logic by tier
 *      (e.g. swap a mascot illustration vs. a no-mascot ambient hero).
 *
 * Sits *above* the existing FL / sensory providers in the tree. The tier
 * controls aesthetics; FL and sensory continue to control density,
 * hit-targets, and motion budgets.
 */
export function TierThemeProvider({
  gradeLevel,
  tier,
  scopeToRoot = true,
  children,
}: TierThemeProviderProps) {
  const resolvedTier: AgeTier = useMemo(() => {
    if (tier) return tier;
    return gradeToTier(gradeLevel ?? null);
  }, [tier, gradeLevel]);

  const theme = TIER_THEMES[resolvedTier];

  // Memoise the CSS-var map so we don't re-write on every render.
  const cssVars = useMemo(() => tierThemeToCssVars(theme), [theme]);

  useEffect(() => {
    if (typeof document === "undefined" || !scopeToRoot) return;
    const root = document.documentElement;
    const previous: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(cssVars)) {
      previous[key] = root.style.getPropertyValue(key) || null;
      root.style.setProperty(key, value);
    }
    root.dataset.tier = resolvedTier;
    return () => {
      for (const [key, prev] of Object.entries(previous)) {
        if (prev) root.style.setProperty(key, prev);
        else root.style.removeProperty(key);
      }
      delete root.dataset.tier;
    };
  }, [cssVars, resolvedTier, scopeToRoot]);

  const ctxValue = useMemo<TierThemeContextValue>(
    () => ({
      tier: resolvedTier,
      theme,
      gradeLevel: gradeLevel == null ? null : String(gradeLevel),
    }),
    [resolvedTier, theme, gradeLevel],
  );

  // When not scoping to root, wrap children in a div that carries the
  // CSS variables locally so the same `var(--tier-*)` consumers work.
  const inlineStyle = scopeToRoot ? undefined : (cssVars as React.CSSProperties);
  const wrapped = scopeToRoot ? (
    children
  ) : (
    <div data-tier={resolvedTier} style={inlineStyle}>
      {children}
    </div>
  );

  return <TierThemeContext.Provider value={ctxValue}>{wrapped}</TierThemeContext.Provider>;
}

/** Read the active tier theme. Throws if used outside `TierThemeProvider`. */
export function useTierTheme(): TierThemeContextValue {
  const ctx = useContext(TierThemeContext);
  if (!ctx) throw new Error("useTierTheme must be used within TierThemeProvider");
  return ctx;
}

/**
 * Soft variant — returns null instead of throwing. Useful for components
 * that may render in both learner and non-learner contexts.
 */
export function useTierThemeOptional(): TierThemeContextValue | null {
  return useContext(TierThemeContext);
}
