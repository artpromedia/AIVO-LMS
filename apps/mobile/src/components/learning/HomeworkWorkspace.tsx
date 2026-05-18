import React from "react";
import { ScrollView, StyleSheet, View, ViewStyle } from "react-native";
import { useWindowSizeClass } from "../../design/useWindowSizeClass";
import { colors, radius, spacing } from "@/constants/colors";

export interface HomeworkWorkspaceProps {
  /** Problem list / adapted-problem queue. */
  problems: React.ReactNode;
  /** Center: scratchpad / camera preview / captured-image preview. */
  work: React.ReactNode;
  /** Right rail: tutor chat. */
  tutor: React.ReactNode;
  /** Optional header (subject, progress). */
  header?: React.ReactNode;
  /** Optional footer (finish button, etc.). */
  footer?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Three-zone tablet workspace for homework sessions.
 *
 *   expanded:  problems | work-area | tutor (three columns).
 *   medium:    problems strip on the left + (work-area on top, tutor below).
 *   compact:   stacked — problems strip, then work, then tutor.
 *
 * Keeps the phone-friendly chat experience available on small screens
 * while unlocking the "solve, draw, ask" pattern on tablets.
 */
export function HomeworkWorkspace({
  problems,
  work,
  tutor,
  header,
  footer,
  style,
}: HomeworkWorkspaceProps) {
  const { sizeClass } = useWindowSizeClass();

  if (sizeClass === "expanded") {
    return (
      <View style={[styles.flex, style]}>
        {header}
        <View style={styles.threeCol}>
          <View style={[styles.panel, styles.problemsCol]}>{problems}</View>
          <View style={[styles.panel, styles.workCol]}>{work}</View>
          <View style={[styles.panel, styles.tutorCol]}>{tutor}</View>
        </View>
        {footer}
      </View>
    );
  }

  if (sizeClass === "medium") {
    return (
      <View style={[styles.flex, style]}>
        {header}
        <View style={styles.twoCol}>
          <View style={[styles.panel, styles.problemsColMedium]}>{problems}</View>
          <View style={styles.rightStack}>
            <View style={[styles.panel, styles.workColMedium]}>{work}</View>
            <View style={[styles.panel, styles.tutorColMedium]}>{tutor}</View>
          </View>
        </View>
        {footer}
      </View>
    );
  }

  return (
    <View style={[styles.flex, style]}>
      {header}
      <ScrollView contentContainerStyle={styles.stack}>
        <View style={[styles.panel, styles.stackPanel]}>{problems}</View>
        <View style={[styles.panel, styles.stackPanel]}>{work}</View>
        <View style={[styles.panel, styles.stackPanel, { minHeight: 280 }]}>{tutor}</View>
      </ScrollView>
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  threeCol: { flex: 1, flexDirection: "row", padding: spacing.md, gap: spacing.md },
  twoCol: { flex: 1, flexDirection: "row", padding: spacing.md, gap: spacing.md },
  rightStack: { flex: 1, gap: spacing.md },
  stack: { gap: spacing.md, padding: spacing.md },
  panel: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    overflow: "hidden",
  },
  problemsCol: { width: 300 },
  workCol: { flex: 1 },
  tutorCol: { width: 360 },
  problemsColMedium: { width: 240 },
  workColMedium: { flex: 1.2 },
  tutorColMedium: { flex: 1 },
  stackPanel: { width: "100%" },
});
