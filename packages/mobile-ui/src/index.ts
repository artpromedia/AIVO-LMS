export { theme, classifySizeClass, isTabletWidth } from "./theme";
export type { SizeClass } from "./theme";
export {
  useResponsiveLayout,
  useResponsiveValue,
  useColumns,
  useContentMaxWidth,
  getResponsiveLayoutSnapshot,
  subscribeResponsiveLayout,
} from "./responsive";
export type { ResponsiveLayout } from "./responsive";
export { AivoButton } from "./AivoButton";
export { AivoCard } from "./AivoCard";
export { AivoHeader } from "./AivoHeader";
export { StatCard } from "./StatCard";
export { EmptyState } from "./EmptyState";
export { LoadingState } from "./LoadingState";
export { TutorCard } from "./TutorCard";
export { MobilePlayfulButton, MobilePlayfulCard } from "./PlayfulPrimitives";
export { MobileSubjectCard } from "./MobileSubjectCard";
export type { MobileSubjectCardProps } from "./MobileSubjectCard";
export { MobileLearningHero } from "./MobileLearningHero";
export type { MobileLearningHeroProps } from "./MobileLearningHero";

export * from "./shell";
export * from "./charts";

// NOTE: the legacy SVG-based `./chart` kit also exports Sparkline / BarMini /
// ProgressRing. The View-based `./charts` versions (star-exported above) are
// the canonical root exports; only the non-conflicting helpers from `./chart`
// are re-exported here. Import from "./chart" directly if you need the SVG kit.
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
} from "./chart";
export type { ChartTone, SensoryPalette, BarItem } from "./chart";

export {
  TIER_THEMES_MOBILE,
  TierThemeProvider,
  useTierTheme,
  useTierThemeOptional,
  gradeToTier,
  gradeToTheme,
} from "./tierTheme";
export type { AgeTier, TierThemeMobile, TierThemeProviderProps } from "./tierTheme";
export { Skeleton, SkeletonRows, skeletonMotion, type SkeletonVariant } from "./Skeleton";
