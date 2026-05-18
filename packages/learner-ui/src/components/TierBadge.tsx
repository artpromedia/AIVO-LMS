"use client";
import React from "react";
import { useTierThemeOptional } from "../adapters/TierThemeProvider";
import { TIER_THEMES, type AgeTier } from "../tokens/age-tiers";

export interface TierBadgeProps {
  /** Override the tier shown. Defaults to the active tier from `TierThemeProvider`. */
  tier?: AgeTier;
  /** Localised label (e.g. "Theme", "Tema"). Defaults to "Theme". */
  label?: string;
  /** Localised tier display name. Defaults to the hardcoded English `theme.name`. */
  name?: string;
  /** Localised tagline. Defaults to the hardcoded English `theme.tagline`. */
  tagline?: string;
  /** When true, render the tagline beneath the name. */
  showTagline?: boolean;
  /** Visual size — `sm` for headers, `md` for cards. */
  size?: "sm" | "md";
  className?: string;
}

/**
 * Read-only badge that surfaces the active age-tier theme to the user
 * (parents and learners). The tier itself is still derived automatically
 * from the learner's grade — this badge just makes the silent palette
 * swap legible: parents can see "your child is on Soft Meadow" instead
 * of guessing why the dashboard looks different per learner.
 *
 * Pulls the theme from `useTierThemeOptional()`. If rendered outside a
 * `TierThemeProvider` (and no `tier` override is given), it returns `null`.
 *
 * The component itself is framework-agnostic — pass localised `label`,
 * `name`, and `tagline` from a wrapper that owns the i18n hook (the web
 * app passes values from the `tier` next-intl namespace; mobile passes
 * values from its own translation source).
 */
export function TierBadge({
  tier,
  label = "Theme",
  name,
  tagline,
  showTagline = false,
  size = "sm",
  className,
}: TierBadgeProps) {
  const ctx = useTierThemeOptional();

  const theme = tier ? TIER_THEMES[tier] : (ctx?.theme ?? null);
  if (!theme) return null;

  const displayName = name ?? theme.name;
  const displayTagline = tagline ?? theme.tagline;

  const padX = size === "md" ? 14 : 10;
  const padY = size === "md" ? 8 : 6;
  const fontSize = size === "md" ? 14 : 12;
  const dot = size === "md" ? 10 : 8;

  return (
    <span
      className={className}
      role="status"
      aria-label={`${label}: ${displayName}${showTagline ? ` — ${displayTagline}` : ""}`}
      data-tier={theme.id}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: `${padY}px ${padX}px`,
        borderRadius: 999,
        background: `var(--tier-primary-soft, ${theme.colors.primarySoft})`,
        color: `var(--tier-primary, ${theme.colors.primary})`,
        fontSize,
        fontWeight: 700,
        fontFamily: "var(--tier-font-display, 'Fredoka', system-ui, sans-serif)",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: dot,
          height: dot,
          borderRadius: "50%",
          background: `var(--tier-accent, ${theme.colors.accent})`,
          boxShadow: `0 0 0 2px var(--tier-surface, ${theme.colors.surface})`,
          flexShrink: 0,
        }}
      />
      <span style={{ display: "inline-flex", flexDirection: "column", gap: 1 }}>
        <span>{displayName}</span>
        {showTagline && (
          <span style={{ fontSize: fontSize - 2, fontWeight: 500, opacity: 0.8 }}>
            {displayTagline}
          </span>
        )}
      </span>
    </span>
  );
}
