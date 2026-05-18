// Sensory-aware button — RN equivalent of the web app's
// `INCLUSIVE_WARM_RECIPES.buttonPrimary` / `buttonGhost`.
//
// Reads the active palette from `useSensoryPalette()` so the bg / text
// / shadow tokens flip in calm + high-contrast modes without screens
// having to re-render. Use this instead of the legacy `AivoButton`
// from `@aivo/mobile-ui` for all new inclusive-warm screens.

import React from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSensoryPalette, useSensoryMode } from "@/context/SensoryModeProvider";
import { fontFamilies } from "@/constants/typography";

type Variant = "primary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  fullWidth?: boolean;
}

const HEIGHTS: Record<Size, number> = { sm: 40, md: 48, lg: 56 };
const FONT_SIZES: Record<Size, number> = { sm: 14, md: 15, lg: 16 };
const PADDING_X: Record<Size, number> = { sm: 16, md: 22, lg: 28 };

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  iconLeft,
  iconRight,
  style,
  accessibilityLabel,
  fullWidth = false,
}: ButtonProps) {
  const palette = useSensoryPalette();
  const { shadowStrength } = useSensoryMode();

  const isPrimary = variant === "primary";
  const isOutline = variant === "outline";

  const bg = isPrimary
    ? palette.primary
    : isOutline
      ? "transparent"
      : palette.bgRaised;

  const fg = isPrimary
    ? palette.primaryFg
    : palette.primary;

  const borderColor = isOutline ? palette.border : "transparent";
  const borderWidth = isOutline ? 1.5 : 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHTS[size],
          paddingHorizontal: PADDING_X[size],
          backgroundColor: bg,
          borderColor,
          borderWidth,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          width: fullWidth ? "100%" : undefined,
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
          // The primary shadow tint is the brand blue at low alpha;
          // shadowStrength comes from the active sensory mode so calm
          // / high-contrast can attenuate or kill it entirely.
          shadowColor: isPrimary ? palette.primary : "#000",
          shadowOpacity: isPrimary ? shadowStrength * 1.6 : shadowStrength,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: isPrimary ? Math.round(shadowStrength * 24) : 0,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {iconLeft ? <View style={styles.iconLeft}>{iconLeft}</View> : null}
          <Text
            style={{
              color: fg,
              fontFamily: fontFamilies.bodyBold,
              fontSize: FONT_SIZES[size],
              letterSpacing: 0.2,
            }}
          >
            {title}
          </Text>
          {iconRight ? <View style={styles.iconRight}>{iconRight}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 9999, // pill — matches INCLUSIVE_WARM_RADII.control
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
});
