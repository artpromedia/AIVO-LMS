"use client";
import { useTranslations } from "next-intl";
import {
  TierBadge,
  useTierThemeOptional,
  TIER_THEMES,
  type AgeTier,
  type TierBadgeProps,
} from "@aivo/learner-ui";

type Props = Omit<TierBadgeProps, "label" | "name" | "tagline"> & {
  /** Optional explicit tier; otherwise the active TierThemeProvider tier is used. */
  tier?: AgeTier;
};

/**
 * Web wrapper around `<TierBadge>` that pulls localised strings from the
 * `tier` next-intl namespace. The underlying `TierBadge` is kept i18n-free
 * so it can be reused from the mobile package without dragging next-intl
 * into the design-system layer.
 */
export function LocalisedTierBadge({ tier, ...rest }: Props) {
  const t = useTranslations("tier");
  const ctx = useTierThemeOptional();
  const theme = tier ? TIER_THEMES[tier] : (ctx?.theme ?? null);
  if (!theme) return null;

  // next-intl throws on missing keys; wrap each lookup so a missing
  // translation falls back to the hardcoded English instead of crashing
  // the whole header.
  const safe = (key: string, fallback: string) => {
    try {
      const v = t(key);
      return v && v !== key ? v : fallback;
    } catch {
      return fallback;
    }
  };

  return (
    <TierBadge
      {...rest}
      tier={tier}
      label={safe("label", "Theme")}
      name={safe(theme.nameKey, theme.name)}
      tagline={safe(theme.taglineKey, theme.tagline)}
    />
  );
}
