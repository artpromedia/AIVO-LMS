import React from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { theme } from "./theme";
import { SkeletonRows, type SkeletonVariant } from "./Skeleton";

interface LoadingStateProps {
  message?: string;
  size?: "small" | "large";
  /**
   * "skeleton-*" renders layout-preserving placeholder rows (default —
   * calmer and CLS-free); "spinner" keeps the legacy centered indicator
   * for genuinely indeterminate inline waits.
   */
  variant?: "skeleton-list" | "skeleton-card" | "skeleton-hero" | "spinner";
  /** Pass the OS reduce-motion flag (apps/mobile: useReducedMotion()). */
  reduceMotion?: boolean;
}

export function LoadingState({
  message = "Loading...",
  size = "large",
  variant = "skeleton-list",
  reduceMotion = false,
}: LoadingStateProps) {
  if (variant !== "spinner") {
    const skeletonVariant = variant.replace("skeleton-", "") as SkeletonVariant;
    return (
      <View
        style={styles.skeletonContainer}
        accessibilityLabel={message}
        accessibilityState={{ busy: true }}
        accessible
      >
        <SkeletonRows variant={skeletonVariant} reduceMotion={reduceMotion} />
      </View>
    );
  }
  return (
    <View style={styles.container} accessibilityLabel={message} accessibilityState={{ busy: true }}>
      <ActivityIndicator size={size} color={theme.colors.primary} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  skeletonContainer: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  message: {
    fontSize: 14,
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    marginTop: 12,
  },
});
