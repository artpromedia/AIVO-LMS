import {
  STEADY_SIGNAL_DEFAULT,
  resolveSteadySignal,
  type SteadySignalSelection,
} from "@aivo/brand";

export const steadySignalTheme = STEADY_SIGNAL_DEFAULT;

export function createSteadySignalTheme(selection: SteadySignalSelection = {}) {
  return resolveSteadySignal(selection);
}

export type SteadySignalStageLayout = "phone" | "tablet-portrait" | "tablet-landscape";

export function classifySteadySignalStage(width: number, height: number): SteadySignalStageLayout {
  if (width < 600) return "phone";
  return width > height ? "tablet-landscape" : "tablet-portrait";
}

export interface SteadySignalDashboardLayout {
  contentMaxWidth: number;
  pagePadding: number;
  statsColumns: 2 | 4;
  heroDirection: "column" | "row";
}

export function steadySignalDashboardLayout(
  layout: SteadySignalStageLayout,
): SteadySignalDashboardLayout {
  if (layout === "tablet-landscape") {
    return {
      contentMaxWidth: 1280,
      pagePadding: 40,
      statsColumns: 4,
      heroDirection: "row",
    };
  }
  if (layout === "tablet-portrait") {
    return {
      contentMaxWidth: 980,
      pagePadding: 36,
      statsColumns: 2,
      heroDirection: "row",
    };
  }
  return {
    contentMaxWidth: 560,
    pagePadding: 20,
    statsColumns: 2,
    heroDirection: "column",
  };
}

export function steadySignalStageColumns(layout: SteadySignalStageLayout) {
  if (layout === "tablet-landscape") return { stage: 2, aac: 1, context: 1 };
  if (layout === "tablet-portrait") return { stage: 1, aac: 1, context: 1 };
  return { stage: 1, aac: 1, context: 0 };
}
