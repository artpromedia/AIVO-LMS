import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { classifyWidth, isTabletWidth, type SizeClass } from "./responsive";

export interface WindowSizeClass {
  width: number;
  height: number;
  sizeClass: SizeClass;
  isTablet: boolean;
  isCompact: boolean;
  isMedium: boolean;
  isExpanded: boolean;
  isLandscape: boolean;
}

/**
 * Resolve the active size class from RN's window dimensions.
 *
 * Re-renders on rotation, multitasking split view changes, and external
 * display attach/detach.
 *
 * ## iPadOS multitasking matrix
 *
 * iPad Split View and Slide Over hand the app an arbitrarily-sized window
 * even when the underlying hardware is a tablet. The size-class hook is
 * width-driven (not device-class-driven), so it folds those modes onto the
 * same `compact / medium / expanded` ladder that phones use. Verified
 * against the breakpoints in `./responsive.ts` (`compact < 600 <= medium
 * < 840 <= expanded`):
 *
 * | Multitasking state                                | Width (pt) | Size class | Nav surface       |
 * | ------------------------------------------------- | ---------- | ---------- | ----------------- |
 * | Slide Over (any iPad)                             | 320 / 375  | compact    | bottom tabs       |
 * | 1/3 Split View (any iPad)                         | 320 / 375  | compact    | bottom tabs       |
 * | 1/2 Split View, iPad 10.2"/9.7" landscape         | 507        | compact    | bottom tabs       |
 * | 1/2 Split View, iPad 11" landscape                | 590        | compact    | bottom tabs       |
 * | 1/2 Split View, iPad portrait (any)               | 504        | compact    | bottom tabs       |
 * | 1/2 Split View, iPad Pro 12.9" landscape          | 678        | medium     | 84pt rail         |
 * | 2/3 Split View, iPad 10.2" portrait               | 438        | compact    | bottom tabs       |
 * | 2/3 Split View, iPad Pro 12.9" portrait           | 639        | medium     | 84pt rail         |
 * | 2/3 Split View, iPad 10.2" landscape              | 694        | medium     | 84pt rail         |
 * | 2/3 Split View, iPad 11" landscape                | 791        | medium     | 84pt rail         |
 * | 2/3 Split View, iPad Pro 12.9" landscape          | 981        | expanded   | 240pt drawer      |
 * | Full screen, iPad portrait                        | 768–834    | medium     | 84pt rail         |
 * | Full screen, iPad landscape                       | 1024–1366  | expanded   | 240pt drawer      |
 *
 * The 600pt `compact` threshold is what makes Slide Over and every 1/3
 * split (plus every 1/2 split narrower than an iPad Pro 12.9") fall back
 * to phone-style bottom tabs with no rail — exactly the behaviour we want,
 * because a 84pt rail at 590pt of total width crowds the content column
 * below the iPad-mini-portrait floor the dashboards were designed against.
 *
 * Dropping the `compact -> medium` boundary below 600pt would re-introduce
 * that crowding: at 590pt (iPad 11" 1/2 Split View landscape) the 84pt
 * rail would leave only ~506pt for content. Bumping it above 678pt would
 * push iPad Pro 12.9" half-split landscape back into `compact` and lose
 * the rail on a pane that has plenty of room for one. Don't move the
 * breakpoints without re-running `__tests__/ipad-multitasking.test.ts`.
 */
export function useWindowSizeClass(): WindowSizeClass {
  const { width, height } = useWindowDimensions();
  return useMemo<WindowSizeClass>(() => {
    const sizeClass = classifyWidth(width);
    return {
      width,
      height,
      sizeClass,
      isTablet: isTabletWidth(width),
      isCompact: sizeClass === "compact",
      isMedium: sizeClass === "medium",
      isExpanded: sizeClass === "expanded",
      isLandscape: width > height,
    };
  }, [width, height]);
}
