import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextStyle,
} from "react-native";
import { theme } from "./theme";

import { SEMANTIC } from "@aivo/brand";
interface AivoButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function AivoButton({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon,
  style,
}: AivoButtonProps) {
  const isPrimary = variant === "primary";
  const isOutline = variant === "outline";
  const isGhost = variant === "ghost";
  const isSecondary = variant === "secondary";

  const heights: Record<string, number> = { sm: 36, md: 48, lg: 56 };
  const fontSizes: Record<string, number> = { sm: 14, md: 16, lg: 18 };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          height: heights[size],
          backgroundColor: isPrimary
            ? theme.colors.primary
            : isSecondary
              ? theme.colors.secondary
              : "transparent",
          borderWidth: isOutline ? 2 : 0,
          borderColor: isOutline ? theme.colors.primary : undefined,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !disabled ? 0.97 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary || isSecondary ? "#fff" : theme.colors.primary} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              {
                fontSize: fontSizes[size],
                color: isPrimary
                  ? SEMANTIC.color.surface.card
                  : isSecondary
                    ? theme.colors.text
                    : isGhost
                      ? theme.colors.textSecondary
                      : theme.colors.primary,
                marginLeft: icon ? 8 : 0,
              },
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  text: {
    fontFamily: theme.fonts.bodyBold,
    letterSpacing: 0.3,
  },
});
