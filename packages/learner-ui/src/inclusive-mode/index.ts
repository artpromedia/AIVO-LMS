/**
 * Inclusive-mode public API. Add new providers/hooks here so consuming
 * apps can import everything from "@aivo/learner-ui/inclusive-mode".
 */
export { HighContrastTheme } from "./HighContrastTheme";
export type { HighContrastThemeProps } from "./HighContrastTheme";

export { DyslexiaFontProvider } from "./DyslexiaFontProvider";
export type { DyslexiaFontProviderProps } from "./DyslexiaFontProvider";

export { ReducedMotionProvider, useReducedMotion } from "./ReducedMotionProvider";
export type { ReducedMotionProviderProps, ReducedMotionState } from "./ReducedMotionProvider";

export { CaptionsContainer, useCaptions } from "./CaptionsContainer";
export type { CaptionsContainerProps, CaptionsApi } from "./CaptionsContainer";

export {
  useAccessibilityPreferences,
  DEFAULT_ACCESSIBILITY_PREFERENCES,
} from "./useAccessibilityPreferences";
export type {
  AccessibilityPreferences,
  UseAccessibilityPreferencesOptions,
  UseAccessibilityPreferencesResult,
} from "./useAccessibilityPreferences";
