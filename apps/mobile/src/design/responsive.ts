/**
 * Responsive breakpoints for AIVO mobile.
 *
 *   compact:  width <  600    (phones, narrow portrait)
 *   medium:   600 <= width < 840  (small tablets, portrait iPad mini)
 *   expanded: width >= 840    (large tablets, landscape iPad, Pixel Tablet)
 *
 * These breakpoints match Material 3 / Apple's iPadOS size classes so a
 * single layout decision can drive both platforms.
 *
 * **Single source of truth, by convention:**
 * The same constants are mirrored in `@aivo/mobile-ui/theme.ts` (which
 * other packages consume) and `@aivo/mobile-ui/responsive.ts` (which
 * exposes a parallel `useResponsiveLayout`/`useColumns` API). Keep the
 * three in lockstep — `__tests__/ipad-multitasking.test.ts` enforces
 * that the breakpoint values here match the iPad multitasking matrix
 * documented in `useWindowSizeClass.ts`.
 *
 * App code should import from this module; shared `mobile-ui`
 * components import from `@aivo/mobile-ui`. Do **not** add a runtime
 * cross-package import — `@aivo/brand` (transitively pulled in by
 * mobile-ui's theme) is a TS-source workspace package and is not
 * resolvable from the vitest node env that drives our breakpoint
 * regression tests.
 */
export const BREAKPOINTS = {
  compact: 0,
  medium: 600,
  expanded: 840,
  xlarge: 1200,
} as const;

export type SizeClass = "compact" | "medium" | "expanded";

export function classifyWidth(width: number): SizeClass {
  if (width >= BREAKPOINTS.expanded) return "expanded";
  if (width >= BREAKPOINTS.medium) return "medium";
  return "compact";
}

/** True when the device is a tablet-class surface (>=600dp on the short side). */
export function isTabletWidth(width: number): boolean {
  return width >= BREAKPOINTS.medium;
}

/** Choose a value per size class, falling back upward. */
export function pickBySizeClass<T>(
  sizeClass: SizeClass,
  values: { compact: T; medium?: T; expanded?: T },
): T {
  if (sizeClass === "expanded") return values.expanded ?? values.medium ?? values.compact;
  if (sizeClass === "medium") return values.medium ?? values.compact;
  return values.compact;
}

/**
 * Content width caps so cards and forms don't stretch edge-to-edge on
 * tablet hardware. Match the values used by the web app's design system
 * and the mirror in `@aivo/mobile-ui/theme.ts`.
 */
export const CONTENT_MAX_WIDTH = {
  auth: 520, // login / signup / pin — single-column form, never stretches
  reading: 720, // long-form text / forms
  workspace: 1280, // learning workspace and split-pane shells
  dashboard: 1080, // parent / teacher dashboards
} as const;

/** Grid column count per size class for card grids. */
export function gridColumns(sizeClass: SizeClass): number {
  if (sizeClass === "expanded") return 4;
  if (sizeClass === "medium") return 3;
  return 2;
}
