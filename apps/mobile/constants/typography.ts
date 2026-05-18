// AIVO mobile typography — Fredoka (display) + Nunito (body).
//
// React Native loads custom fonts at startup; this module centralizes
// the font map so `app/_layout.tsx` can pass it to `expo-font`'s
// `useFonts()` and screens can reference `fontFamilies.*` instead of
// stringly-typed `"Nunito-Bold"` literals.
//
// DEFERRED SCOPE — Fredoka asset bundling (tracked as follow-up #8):
//   The inclusive-warm spec calls for Fredoka as the display family,
//   but the Fredoka .ttf files are intentionally NOT bundled in this
//   change (license + designer review pending). This is explicitly
//   deferred scope — see follow-up task #8 "Bundle Fredoka TTFs into
//   apps/mobile/assets/fonts/" for the tracking item.
//
//   Until those assets ship, `fontFamilies.display*` aliases to the
//   already-bundled `Nunito-*` family so screens render at the right
//   weight/silhouette without crashing on a missing asset. Every
//   consumer reads from `fontFamilies.*` (no `"Fredoka-..."` string
//   literals anywhere in the app), so the Fredoka swap is a one-file
//   change: flip the constants in the `// FREDOKA SWAP POINT` block
//   below and uncomment the matching entries in `FONT_ASSETS`. No
//   screen-level changes will be required.

// FREDOKA SWAP POINT ─────────────────────────────────────────────────
// const DISPLAY_REGULAR = "Fredoka-Regular";
// const DISPLAY_MEDIUM = "Fredoka-Medium";
// const DISPLAY_SEMIBOLD = "Fredoka-SemiBold";
// const DISPLAY_BOLD = "Fredoka-Bold";
const DISPLAY_REGULAR = "Nunito-SemiBold";
const DISPLAY_MEDIUM = "Nunito-Bold";
const DISPLAY_SEMIBOLD = "Nunito-Bold";
const DISPLAY_BOLD = "Nunito-ExtraBold";
// ─────────────────────────────────────────────────────────────────────

export const FONT_ASSETS = {
  // Bundled today:
  "Nunito-Regular": require("@/assets/fonts/Nunito-Regular.ttf"),
  "Nunito-SemiBold": require("@/assets/fonts/Nunito-SemiBold.ttf"),
  "Nunito-Bold": require("@/assets/fonts/Nunito-Bold.ttf"),
  "Nunito-ExtraBold": require("@/assets/fonts/Nunito-ExtraBold.ttf"),
  // Pending Fredoka TTFs (see swap-point note above):
  // "Fredoka-Regular": require("@/assets/fonts/Fredoka-Regular.ttf"),
  // "Fredoka-Medium": require("@/assets/fonts/Fredoka-Medium.ttf"),
  // "Fredoka-SemiBold": require("@/assets/fonts/Fredoka-SemiBold.ttf"),
  // "Fredoka-Bold": require("@/assets/fonts/Fredoka-Bold.ttf"),
} as const;

/** Canonical font-family names. Use these everywhere instead of
 *  string literals so the Fredoka swap is a one-file change. */
export const fontFamilies = {
  // Display — used for hero headlines, greetings, level labels,
  // anything that wants the rounded "Fredoka" silhouette from the
  // inclusive-warm spec.
  displayRegular: DISPLAY_REGULAR,
  displayMedium: DISPLAY_MEDIUM,
  displaySemiBold: DISPLAY_SEMIBOLD,
  displayBold: DISPLAY_BOLD,

  // Body — Nunito (already bundled).
  bodyRegular: "Nunito-Regular",
  bodySemiBold: "Nunito-SemiBold",
  bodyBold: "Nunito-Bold",
  bodyExtraBold: "Nunito-ExtraBold",
} as const;

/** Typographic ramp matching the inclusive-warm mockup's scale. */
export const typography = {
  heroDisplay: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.4,
  },
  h1: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: fontFamilies.displaySemiBold,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  h3: {
    fontFamily: fontFamilies.displaySemiBold,
    fontSize: 17,
    lineHeight: 22,
  },
  bodyLg: {
    fontFamily: fontFamilies.bodyRegular,
    fontSize: 16,
    lineHeight: 22,
  },
  bodyMd: {
    fontFamily: fontFamilies.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  bodyBold: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  tiny: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.4,
  },
} as const;
