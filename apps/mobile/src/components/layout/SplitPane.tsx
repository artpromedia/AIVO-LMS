import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { useWindowSizeClass } from "../../design/useWindowSizeClass";
import { colors, spacing, radius } from "@/constants/colors";

export interface SplitPaneProps {
  /** Left panel content (or top on phones). */
  left: React.ReactNode;
  /** Right panel content (or bottom on phones). */
  right: React.ReactNode;
  /** Optional center panel. Three-pane layout when provided. */
  center?: React.ReactNode;
  /** Width of the left rail in dp at medium+ sizes. */
  leftWidth?: number;
  /** Width of the right rail in dp at expanded sizes. */
  rightWidth?: number;
  /**
   * Minimum size class required to actually split. Below this, panels are
   * stacked vertically (phone behavior). Default: 'medium'.
   */
  minSplitClass?: "medium" | "expanded";
  gap?: number;
  style?: ViewStyle;
}

/**
 * Two- or three-pane split layout. Stacks vertically on phones and small
 * tablets in portrait; splits side-by-side on tablets in landscape and
 * larger devices.
 */
export function SplitPane({
  left,
  right,
  center,
  leftWidth = 280,
  rightWidth = 360,
  minSplitClass = "medium",
  gap = spacing.md,
  style,
}: SplitPaneProps) {
  const { sizeClass, isLandscape } = useWindowSizeClass();
  const canSplit =
    sizeClass === "expanded" ||
    (sizeClass === "medium" && minSplitClass === "medium" && (isLandscape || !!center));

  if (!canSplit) {
    return (
      <View style={[styles.stack, { gap }, style]}>
        <View style={styles.stackPanel}>{left}</View>
        {center ? <View style={styles.stackPanel}>{center}</View> : null}
        <View style={styles.stackPanel}>{right}</View>
      </View>
    );
  }

  const showThreePane = !!center && sizeClass === "expanded";

  return (
    <View style={[styles.row, { gap }, style]}>
      <View style={[styles.panel, { width: leftWidth }]}>{left}</View>
      {
        showThreePane ? (
          <View style={[styles.panel, styles.flexPanel]}>{center}</View>
        ) : center && !showThreePane ? null : null // Medium tablet: center merges with right or left
      }
      <View style={[styles.panel, showThreePane ? { width: rightWidth } : styles.flexPanel]}>
        {showThreePane ? right : (center ?? right)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: "row" },
  stack: { flex: 1, flexDirection: "column" },
  panel: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    overflow: "hidden",
  },
  flexPanel: { flex: 1 },
  stackPanel: { width: "100%" },
});
