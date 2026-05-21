import { useMemo } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/constants/colors";

/**
 * Single source of truth for the Expo Router `<Tabs>` `tabBarStyle`
 * (and matching `tabBarLabelStyle`) used by every role layout.
 *
 * Replaces the inline `{ height: 84, paddingBottom: 20, ... }` literal
 * each role layout used to ship — that 20px was a hard-coded guess for
 * the home indicator on iPhone, and it was wrong on:
 *
 *   - older iPhones with a physical home button (over-padded)
 *   - Android phones with on-screen / gesture nav (under-padded)
 *   - iPads in landscape (over-padded)
 *
 * The hook pulls the real device inset from
 * `react-native-safe-area-context` so the bar sits flush against the
 * gesture indicator on every form factor.
 *
 * Pass `hidden: true` (e.g. on tablet where a side rail replaces the
 * bottom bar) to return `{ display: "none" }`.
 */
export function useTabBarStyle({
  hidden = false,
  backgroundColor,
  borderTopColor,
}: {
  hidden?: boolean;
  /** Override the default card surface (e.g. the learner theme). */
  backgroundColor?: string;
  /** Override the default border color. */
  borderTopColor?: string;
} = {}) {
  const insets = useSafeAreaInsets();
  return useMemo(() => {
    if (hidden) return { display: "none" as const };

    // 8px content padding on top, 6px above the home indicator on iOS
    // (which already gets `insets.bottom` of ~34px), 8px above the
    // gesture/nav bar on Android (where insets.bottom is typically 0
    // on legacy 3-button nav, ~24px on gesture nav).
    const verticalChromeIOS = 6;
    const verticalChromeAndroid = 8;
    const chromeBottom = Platform.OS === "ios" ? verticalChromeIOS : verticalChromeAndroid;
    const paddingBottom = Math.max(insets.bottom + chromeBottom, 12);
    // Base intrinsic bar height (icon + label) stays at 56; insets +
    // chrome grow it from the bottom.
    const intrinsicHeight = 56;
    return {
      backgroundColor: backgroundColor ?? colors.card,
      borderTopColor: borderTopColor ?? colors.border,
      paddingTop: 8,
      paddingBottom,
      height: intrinsicHeight + paddingBottom,
    } as const;
  }, [hidden, insets.bottom, backgroundColor, borderTopColor]);
}

/**
 * Matching label style — kept here so tab typography ALSO has a single
 * source of truth.
 */
export const TAB_BAR_LABEL_STYLE = {
  fontFamily: "Nunito-SemiBold",
  fontSize: 11,
} as const;
