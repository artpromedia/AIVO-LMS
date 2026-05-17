/**
 * React Native hook wrapper around `resolveStageLayout`.
 *
 * Re-renders on rotation, iPadOS split-view drag, and external-display
 * attach/detach. See `./stageLayout.ts` for the pure resolver and the
 * Sprint 07 breakpoint matrix.
 */

import { useMemo } from "react";
import { useWindowSizeClass } from "./useWindowSizeClass";
import { resolveStageLayout, type StageLayout } from "./stageLayout";

export type { StageLayout, StageMode } from "./stageLayout";
export { resolveStageLayout } from "./stageLayout";

/**
 * React hook returning the live stage layout. Recomputes on rotation,
 * iPadOS split-view drag, and external-display attach.
 */
export function useStageLayout(): StageLayout {
  const { width, height } = useWindowSizeClass();
  return useMemo(() => resolveStageLayout(width, height), [width, height]);
}
