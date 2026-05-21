/**
 * Pure layout decision logic for `SplitPane`. Extracted so it can be
 * unit-tested at the iPad multitasking widths covered by
 * `__tests__/ipad-multitasking.test.ts` without spinning up a RN
 * renderer.
 *
 * Rules (mirrored from `components/layout/SplitPane.tsx`):
 *
 *   - Compact (<600dp) always stacks vertically.
 *   - Medium (600-839dp) splits horizontally when:
 *       a) `minSplitClass` is `'medium'` AND
 *       b) the window is in landscape OR a `center` panel is provided.
 *     Otherwise it stacks.
 *   - Expanded (>=840dp) always splits horizontally.
 *   - Three-pane (left | center | right) only renders on `expanded`
 *     when `center` is provided. On medium the center pane folds into
 *     the right column to avoid crowding.
 */
import type { SizeClass } from "./responsive";

export interface SplitPaneLayoutInput {
  sizeClass: SizeClass;
  isLandscape: boolean;
  hasCenter: boolean;
  minSplitClass?: "medium" | "expanded";
}

export interface SplitPaneLayout {
  /** True when panels render side-by-side; false when they stack. */
  canSplit: boolean;
  /** True when left | center | right are rendered as three columns. */
  showThreePane: boolean;
}

export function resolveSplitPaneLayout({
  sizeClass,
  isLandscape,
  hasCenter,
  minSplitClass = "medium",
}: SplitPaneLayoutInput): SplitPaneLayout {
  const canSplit =
    sizeClass === "expanded" ||
    (sizeClass === "medium" && minSplitClass === "medium" && (isLandscape || hasCenter));
  const showThreePane = canSplit && hasCenter && sizeClass === "expanded";
  return { canSplit, showThreePane };
}
