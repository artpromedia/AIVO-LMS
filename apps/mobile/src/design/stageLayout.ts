/**
 * Pure stage-layout resolver (no React / React Native imports).
 *
 * Lives in its own module so the resolver can be exercised under the
 * mobile vitest (node env) without dragging in `react-native`'s
 * `useWindowDimensions`, which the rollup-based test runner can't load.
 *
 * The companion `useStageLayout` hook in `./useStageLayout.ts` consumes
 * this resolver inside a React Native component tree.
 */
import { classifyWidth, CONTENT_MAX_WIDTH } from "./responsive";

export type StageMode = "stacked" | "split";

export interface StageLayout {
  /** "split" → side-by-side tutor + beat; "stacked" → vertical. */
  mode: StageMode;
  /** Maximum width (dp) the runtime should occupy. */
  contentMaxWidth: number;
  /** Width (dp) of the tutor rail in split mode. Unused when stacked. */
  tutorPanelWidth: number;
  /** Inner gutter (dp) between tutor + beat in split mode. */
  splitGap: number;
}

export function resolveStageLayout(width: number, height: number): StageLayout {
  const sizeClass = classifyWidth(width);
  const isLandscape = width > height;
  const split = sizeClass === "expanded" || (sizeClass === "medium" && isLandscape);

  return {
    mode: split ? "split" : "stacked",
    contentMaxWidth: split ? CONTENT_MAX_WIDTH.workspace : CONTENT_MAX_WIDTH.dashboard,
    tutorPanelWidth: sizeClass === "expanded" ? 360 : 320,
    splitGap: 16,
  };
}
