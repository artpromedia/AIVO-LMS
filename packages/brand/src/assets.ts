// Canonical brand asset paths.
//
// Two kinds of paths live here:
//
// 1. `LEGACY_*` — names of files that already ship in apps/web/public/images,
//    apps/marketing/public/images, and apps/mobile/assets/images. These are
//    the paths everything currently imports. Do not rename or remove these
//    until every consumer is migrated to the canonical names below.
//
// 2. `CANONICAL_*` — the target naming scheme per Sprint 01. New work
//    should reference these. `scripts/brand-asset-check.mjs` reports which
//    canonical files are still missing in each app, without breaking the
//    build, so the migration can land incrementally.

export const LEGACY_LOGOS = {
  dark: "/images/aivo-logo-dark.png",
  purple: "/images/aivo-logo-purple.png",
  white: "/images/aivo-logo-white.png",
  favicon: "/images/favicon-192.png",
  og: "/images/og-banner.png",
} as const;

export const CANONICAL_LOGOS = {
  horizontalPurple: "/images/aivo-logo-horizontal-purple.png",
  horizontalDark: "/images/aivo-logo-horizontal-dark.png",
  horizontalWhite: "/images/aivo-logo-horizontal-white.png",
  horizontalPurpleSvg: "/images/aivo-logo-horizontal-purple.svg",
  horizontalDarkSvg: "/images/aivo-logo-horizontal-dark.svg",
  horizontalWhiteSvg: "/images/aivo-logo-horizontal-white.svg",
} as const;

export const CANONICAL_ICONS = {
  iconPurple: "/images/aivo-icon-purple.png",
  iconDark: "/images/aivo-icon-dark.png",
  iconWhite: "/images/aivo-icon-white.png",
  iconPurpleSvg: "/images/aivo-icon-purple.svg",
  iconDarkSvg: "/images/aivo-icon-dark.svg",
  iconWhiteSvg: "/images/aivo-icon-white.svg",
} as const;

export const CANONICAL_FAVICONS = {
  fav16: "/images/favicon-16.png",
  fav32: "/images/favicon-32.png",
  fav192: "/images/favicon-192.png",
  fav512: "/images/favicon-512.png",
  appleTouchIcon: "/images/apple-touch-icon.png",
} as const;

export const CANONICAL_SPLASH = {
  light: "/images/splash_logo.png",
  dark: "/images/splash_logo_dark.png",
} as const;

export const CANONICAL_SOCIAL = {
  ogBanner: "/images/og-banner.png",
} as const;

/**
 * Resolves a logo path, preferring the canonical asset when present and
 * falling back to the legacy asset otherwise. The presence check happens
 * at build time in the consuming app — this function only declares the
 * preferred order.
 */
export function resolveLogo(variant: "purple" | "dark" | "white"): {
  preferred: string;
  fallback: string;
} {
  switch (variant) {
    case "purple":
      return {
        preferred: CANONICAL_LOGOS.horizontalPurple,
        fallback: LEGACY_LOGOS.purple,
      };
    case "dark":
      return {
        preferred: CANONICAL_LOGOS.horizontalDark,
        fallback: LEGACY_LOGOS.dark,
      };
    case "white":
      return {
        preferred: CANONICAL_LOGOS.horizontalWhite,
        fallback: LEGACY_LOGOS.white,
      };
  }
}

export const REQUIRED_BRAND_ASSETS = {
  // Files that MUST exist in every public-facing app or `brand:check`
  // fails. These are the minimum needed for a usable production
  // experience.
  critical: [LEGACY_LOGOS.purple, LEGACY_LOGOS.white, LEGACY_LOGOS.favicon],
  // Canonical targets. Missing canonical assets surface as warnings.
  canonical: [
    ...Object.values(CANONICAL_LOGOS).filter((p) => p.endsWith(".png")),
    ...Object.values(CANONICAL_ICONS).filter((p) => p.endsWith(".png")),
    CANONICAL_FAVICONS.fav16,
    CANONICAL_FAVICONS.fav32,
    CANONICAL_FAVICONS.fav192,
    CANONICAL_FAVICONS.fav512,
    CANONICAL_FAVICONS.appleTouchIcon,
    CANONICAL_SPLASH.light,
    CANONICAL_SPLASH.dark,
    CANONICAL_SOCIAL.ogBanner,
  ],
} as const;
