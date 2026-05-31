import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "../theme";

/**
 * Shared loading / error / empty chrome for every chart primitive, so
 * the mobile charts behave like their web `@aivo/ui` counterparts
 * (which all accept `loading`, `error`, `empty`). When none of those
 * are set, the children render.
 */
export interface ChartStateProps {
  loading?: boolean;
  error?: string;
  empty?: boolean;
  emptyLabel?: string;
}

export interface ChartFrameProps extends ChartStateProps {
  /** Fixed height for placeholder states so layout doesn't jump. */
  height: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ChartFrame({
  loading,
  error,
  empty,
  emptyLabel = "No data yet",
  height,
  children,
  style,
}: ChartFrameProps) {
  if (loading) {
    return (
      <View
        accessibilityState={{ busy: true }}
        style={[styles.placeholder, styles.loading, { height }, style]}
      />
    );
  }
  if (error) {
    return (
      <View
        accessibilityRole="alert"
        style={[styles.placeholder, styles.error, { minHeight: height }, style]}
      >
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  if (empty) {
    return (
      <View style={[styles.placeholder, styles.empty, { minHeight: height }, style]}>
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  placeholder: {
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
  },
  loading: {
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  error: {
    backgroundColor: theme.colors.error + "0D",
    borderWidth: 1,
    borderColor: theme.colors.error + "66",
  },
  errorText: {
    color: theme.colors.error,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    textAlign: "center",
  },
  empty: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.border,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    textAlign: "center",
  },
});
