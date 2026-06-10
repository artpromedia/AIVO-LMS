/**
 * Mobile chart kit — SVG-based primitives built on react-native-svg.
 * Sensory-palette aware; mirrors the visual language of @aivo/ui/chart.
 */
export { Sparkline } from "./Sparkline";
export type { SparklineProps } from "./Sparkline";
export { BarMini } from "./BarMini";
export type { BarMiniProps } from "./BarMini";
export { ProgressRing } from "./ProgressRing";
export type { ProgressRingProps } from "./ProgressRing";
export {
  toneColor,
  toneSoftColor,
  sparklinePoints,
  buildSparklineLabel,
  sparklineTrendText,
  barFillRatios,
  buildBarMiniLabel,
  ringDash,
  buildProgressRingLabel,
  DEFAULT_PALETTE,
} from "./chartHelpers";
export type { ChartTone, SensoryPalette, BarItem } from "./chartHelpers";
