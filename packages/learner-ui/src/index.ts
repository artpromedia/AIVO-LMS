export { FL_PROFILES } from "./tokens/fl-profiles";
export type { FunctioningLevel, FlProfile } from "./tokens/fl-profiles";

export { MOTION_BUDGETS } from "./tokens/motion";
export type { MotionBudget } from "./tokens/motion";

export {
  computeSensoryVars,
  writeSensoryVarsToRoot,
  clearSensoryVarsFromRoot,
  sensoryVarsToCSS,
} from "./tokens/sensory-vars";
export type { SensoryProfile, SensoryVars } from "./tokens/sensory-vars";

export { LearnerButton } from "./primitives/Button";
export type { LearnerButtonProps } from "./primitives/Button";

export { IconText } from "./primitives/IconText";
export type { IconTextProps } from "./primitives/IconText";

export { LearnerCard } from "./primitives/Card";
export type { LearnerCardProps } from "./primitives/Card";

export { LearnerShell } from "./layout/LearnerShell";
export type { LearnerShellProps } from "./layout/LearnerShell";

export { PrimarySlot } from "./layout/PrimarySlot";
export type { PrimarySlotProps, NextAction } from "./layout/PrimarySlot";

export { TabsRail } from "./layout/TabsRail";
export type { TabsRailProps, TabItem } from "./layout/TabsRail";

export { BreakCloud } from "./feedback/BreakCloud";
export type { BreakCloudProps, BreakActivity } from "./feedback/BreakCloud";

export { Celebration } from "./feedback/Celebration";
export type { CelebrationProps } from "./feedback/Celebration";

export { PreviewOverlay } from "./feedback/PreviewOverlay";
export type { PreviewOverlayProps } from "./feedback/PreviewOverlay";

export { SensoryProvider, useSensoryContext } from "./adapters/SensoryProvider";
export type { SensoryProviderProps } from "./adapters/SensoryProvider";

export { FlVariantProvider, useFlVariant } from "./adapters/FlVariantProvider";
export type { FlVariantProviderProps } from "./adapters/FlVariantProvider";

export { TIER_THEMES, gradeToTier, gradeToTheme, tierThemeToCssVars } from "./tokens/age-tiers";
export type { AgeTier, TierTheme } from "./tokens/age-tiers";

export {
  TierThemeProvider,
  useTierTheme,
  useTierThemeOptional,
} from "./adapters/TierThemeProvider";
export type { TierThemeProviderProps } from "./adapters/TierThemeProvider";

export { TierBadge } from "./components/TierBadge";
export type { TierBadgeProps } from "./components/TierBadge";

export { SkipLink } from "./a11y/SkipLink";
export type { SkipLinkProps } from "./a11y/SkipLink";

export { LiveRegion } from "./a11y/LiveRegion";
export type { LiveRegionProps } from "./a11y/LiveRegion";

export {
  Button as PlayfulButton,
  Card as PlayfulCard,
  Input as PlayfulInput,
  Select as PlayfulSelect,
  Checkbox as PlayfulCheckbox,
  Radio as PlayfulRadio,
  Switch as PlayfulSwitch,
  Badge as PlayfulBadge,
  Chip as PlayfulChip,
  Tag as PlayfulTag,
  Avatar as PlayfulAvatar,
  Modal as PlayfulModal,
  Sheet as PlayfulSheet,
  Toast as PlayfulToast,
  Tooltip as PlayfulTooltip,
  ProgressBar as PlayfulProgressBar,
  ProgressRing as PlayfulProgressRing,
  XPMeter,
  StreakFlame,
  Tabs as PlayfulTabs,
  Accordion as PlayfulAccordion,
  Stepper as PlayfulStepper,
} from "./playful-calm/primitives";
export {
  LessonCard,
  TopicGrid,
  LearningPath,
  MascotCoach,
  RewardCelebration,
  StickerBook,
  AudioControlBar,
  AgeModeSwitcher,
  FocusMode,
} from "./playful-calm/patterns";
export { MOTION_VARIANTS } from "./motion/variants";
export { useSfx } from "./sound/useSfx";
export {
  PLAYFUL_CALM_AGE_MODES,
  resolvePlayfulCalmAgeMode,
} from "./tokens/playful-calm-modes";
export type { PlayfulCalmAgeMode } from "./tokens/playful-calm-modes";

// Inclusive-mode providers + hooks (Sprint 15).
export {
  HighContrastTheme,
  DyslexiaFontProvider,
  ReducedMotionProvider,
  useReducedMotion,
  CaptionsContainer,
  useCaptions,
  useAccessibilityPreferences,
  DEFAULT_ACCESSIBILITY_PREFERENCES,
} from "./inclusive-mode";
export type {
  HighContrastThemeProps,
  DyslexiaFontProviderProps,
  ReducedMotionProviderProps,
  ReducedMotionState,
  CaptionsContainerProps,
  CaptionsApi,
  AccessibilityPreferences,
  UseAccessibilityPreferencesOptions,
  UseAccessibilityPreferencesResult,
} from "./inclusive-mode";
