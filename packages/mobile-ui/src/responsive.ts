import { useEffect, useState, useMemo } from "react";
import { Dimensions, type ScaledSize, useWindowDimensions } from "react-native";
import { theme, classifySizeClass, isTabletWidth, type SizeClass } from "./theme";

/**
 * Responsive layout primitives for the AIVO mobile app.
 *
 * React Native doesn't have CSS-style media queries, so every screen
 * that wants tablet-aware behavior has to read `useWindowDimensions()`
 * and branch by hand. This module bundles the common patterns:
 *
 *   - `useResponsiveLayout()` — returns the current width, size class,
 *     `isTablet` flag, and a recommended content max-width for the
 *     active screen type. Re-renders on rotation / split-screen resize.
 *   - `useColumns(count)` — picks a column count from a {compact,
 *     medium, expanded} record so card grids land at 1-col on phone,
 *     2-col on iPad portrait, 3-col on iPad landscape.
 *   - `useContentMaxWidth(kind)` — pulls the matching cap from
 *     `theme.contentMaxWidth` so reading flows don't stretch
 *     edge-to-edge on a 12.9" iPad.
 *
 * **Mirrored module:** `apps/mobile/src/design/responsive.ts` exposes
 * a parallel API (`pickBySizeClass`, `gridColumns`, `CONTENT_MAX_WIDTH`)
 * with the same breakpoints. Keep both files in lockstep — runtime
 * cross-import is intentionally avoided because `@aivo/brand`
 * (transitively pulled in by `theme.ts`) is not resolvable from
 * vitest's node environment, and the breakpoint regression tests live
 * on the app side.
 *
 * Wiring these hooks into the learner home, subject hub, and tutor
 * screens fixes the "magnified phone" rendering on iPad without
 * rebuilding the underlying components.
 */

export interface ResponsiveLayout {
  width: number;
  height: number;
  sizeClass: SizeClass;
  isTablet: boolean;
  /** Convenience: true when `sizeClass === "expanded"` (iPad landscape, large desktop windows). */
  isExpanded: boolean;
  /** Default content cap for a "dashboard"-style screen. Use `useContentMaxWidth(kind)` for finer control. */
  contentMaxWidth: number;
}

/**
 * Read the current window dimensions and classify them into a size
 * class. Re-renders on rotation / Stage Manager resize. Safe to call
 * from any function component (uses RN's own hook under the hood).
 */
export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();
  return useMemo(() => {
    const sizeClass = classifySizeClass(width);
    return {
      width,
      height,
      sizeClass,
      isTablet: isTabletWidth(width),
      isExpanded: sizeClass === "expanded",
      contentMaxWidth:
        sizeClass === "expanded"
          ? theme.contentMaxWidth.dashboard
          : sizeClass === "medium"
            ? theme.contentMaxWidth.reading
            : width,
    };
  }, [width, height]);
}

/**
 * Pick a value (typically a column count) based on the active size
 * class. Defaults to the compact entry if a class is missing.
 *
 * ```tsx
 * const cols = useResponsiveValue({ compact: 1, medium: 2, expanded: 3 });
 * <FlatList numColumns={cols} ... />
 * ```
 */
export function useResponsiveValue<T>(map: Partial<Record<SizeClass, T>> & { compact: T }): T {
  const { sizeClass } = useResponsiveLayout();
  return (map[sizeClass] ?? map.compact) as T;
}

/**
 * Shorthand for the common "how many columns should I render?" case.
 * Caller passes any subset of size classes; missing entries inherit
 * from the next narrower class.
 *
 * ```tsx
 * const cols = useColumns({ compact: 1, medium: 2, expanded: 3 });
 * ```
 */
export function useColumns(map: { compact: number; medium?: number; expanded?: number }): number {
  const { sizeClass } = useResponsiveLayout();
  if (sizeClass === "expanded") return map.expanded ?? map.medium ?? map.compact;
  if (sizeClass === "medium") return map.medium ?? map.compact;
  return map.compact;
}

/**
 * Recommended content max-width for the given screen type, capped to
 * the actual viewport so phones get a full-bleed layout and large
 * tablets get a comfortable reading column.
 */
export function useContentMaxWidth(kind: keyof typeof theme.contentMaxWidth): number {
  const { width } = useResponsiveLayout();
  return Math.min(width, theme.contentMaxWidth[kind]);
}

/**
 * Non-hook entry point for code paths outside the React tree (e.g.
 * Navigation stack initial layout). Returns a snapshot — does not
 * subscribe to dimension changes.
 */
export function getResponsiveLayoutSnapshot(): ResponsiveLayout {
  const { width, height } = Dimensions.get("window");
  const sizeClass = classifySizeClass(width);
  return {
    width,
    height,
    sizeClass,
    isTablet: isTabletWidth(width),
    isExpanded: sizeClass === "expanded",
    contentMaxWidth:
      sizeClass === "expanded"
        ? theme.contentMaxWidth.dashboard
        : sizeClass === "medium"
          ? theme.contentMaxWidth.reading
          : width,
  };
}

/**
 * Tiny convenience: subscribe to dimension changes outside of React
 * (e.g. inside a Context provider's effect). Returns a cleanup fn.
 */
export function subscribeResponsiveLayout(cb: (s: ScaledSize) => void): () => void {
  const sub = Dimensions.addEventListener("change", ({ window }) => cb(window));
  return () => sub.remove();
}

/**
 * Re-export the static helpers so callers don't have to import from
 * two places.
 */
export { classifySizeClass, isTabletWidth };
export type { SizeClass };

/**
 * Side-effect-free check used by `getResponsiveLayoutSnapshot()` tests.
 * Not exported; included here so the build sees the import as used in
 * downstream files that mock useEffect/useState.
 */
const _touch = [useEffect, useState];
void _touch;
