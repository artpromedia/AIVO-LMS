/**
 * Mobile accessibility-style helpers.
 *
 * Resolves the runtime body font family from the dyslexia-friendly-font
 * preference (the web app swaps the family via `data-typeface`; mobile had no
 * equivalent until this hook), and exposes a screen-reader announcement helper
 * so dynamic events (answer feedback, save status, break prompts) reach
 * VoiceOver / TalkBack users via a live region.
 */
import { AccessibilityInfo } from "react-native";
import { fontFamilies, DYSLEXIC_BODY_FONT } from "@/constants/typography";
import { useA11yPreferences } from "./preferences";

export interface A11yStyle {
  /** Body font family honoring the dyslexia-friendly preference. */
  bodyFontFamily: string;
  /** True when the dyslexia-friendly font is active. */
  dyslexic: boolean;
  /** Announce a transient message to TalkBack / VoiceOver. */
  announce: (message: string) => void;
}

export function useA11yStyle(): A11yStyle {
  const { prefs } = useA11yPreferences();
  const dyslexic = prefs.dyslexiaFriendlyFont;
  return {
    bodyFontFamily: dyslexic ? DYSLEXIC_BODY_FONT : fontFamilies.bodyRegular,
    dyslexic,
    announce: (message: string) => {
      if (message) AccessibilityInfo.announceForAccessibility(message);
    },
  };
}
