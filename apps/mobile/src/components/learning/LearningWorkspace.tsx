import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useWindowSizeClass } from "../../design/useWindowSizeClass";
import { ScratchPad, type ScratchStroke } from "./ScratchPad";
import { colors, radius, spacing } from "@/constants/colors";
import i18n from "@/lib/i18n";

export interface LearningWorkspaceProps {
  /**
   * Main assessment / lesson content. Renders on the left on tablets and
   * on top on phones.
   */
  problem: React.ReactNode;
  /**
   * Tutor chat / hint surface. Renders on the right rail on expanded
   * tablets and collapses to a bottom sheet on phones.
   */
  tutor: React.ReactNode;
  /**
   * Optional header (progress bar, navigation controls).
   */
  header?: React.ReactNode;
  /**
   * Optional footer (next/submit controls).
   */
  footer?: React.ReactNode;
  /**
   * If true, render a scratchpad between the problem and tutor on tablets.
   * On phones, the scratchpad is reachable via a floating "Work area"
   * button that opens an overlay.
   */
  scratchpad?: boolean;
  /** Grid paper background for the scratchpad. */
  scratchpadGrid?: boolean;
  /** Persisted strokes for the scratchpad. */
  initialStrokes?: ScratchStroke[];
  /** Fires whenever scratchpad strokes change. */
  onStrokesChange?: (strokes: ScratchStroke[]) => void;
  /** Background colour. */
  background?: string;
  style?: ViewStyle;
}

/**
 * Tablet-first learning shell.
 *
 *   expanded (>=840dp):  three-column layout — problem | scratchpad | tutor.
 *   medium  (>=600dp):   two-column layout  — problem | (scratchpad+tutor stack).
 *   compact (<600dp):    stacked, with a floating scratchpad overlay and a
 *                        collapsible tutor drawer.
 *
 * The renderer is intentionally layout-only — the screen passes in the
 * problem and tutor content as React nodes, so the same workspace works
 * for an adaptive lesson, a homework session, or a baseline assessment.
 */
export function LearningWorkspace({
  problem,
  tutor,
  header,
  footer,
  scratchpad = true,
  scratchpadGrid = false,
  initialStrokes,
  onStrokesChange,
  background,
  style,
}: LearningWorkspaceProps) {
  const { sizeClass } = useWindowSizeClass();
  const [scratchOpen, setScratchOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(true);

  const bg = { backgroundColor: background ?? colors.background };

  if (sizeClass === "expanded") {
    return (
      <View style={[styles.flex, bg, style]}>
        {header}
        <View style={styles.threePane}>
          <View style={[styles.pane, styles.problemPane]}>{problem}</View>
          {scratchpad ? (
            <View style={[styles.pane, styles.scratchPane]}>
              <ScratchPad
                gridPaper={scratchpadGrid}
                initialStrokes={initialStrokes}
                onChange={onStrokesChange}
              />
            </View>
          ) : null}
          <View style={[styles.pane, styles.tutorPane]}>{tutor}</View>
        </View>
        {footer}
      </View>
    );
  }

  if (sizeClass === "medium") {
    return (
      <View style={[styles.flex, bg, style]}>
        {header}
        <View style={styles.twoPane}>
          <View style={[styles.pane, styles.problemPaneMedium]}>{problem}</View>
          <View style={[styles.pane, styles.rightStackMedium]}>
            {scratchpad ? (
              <View style={[styles.scratchPaneMedium]}>
                <ScratchPad
                  compactToolbar
                  gridPaper={scratchpadGrid}
                  initialStrokes={initialStrokes}
                  onChange={onStrokesChange}
                />
              </View>
            ) : null}
            <View style={styles.tutorPaneMedium}>{tutor}</View>
          </View>
        </View>
        {footer}
      </View>
    );
  }

  return (
    <View style={[styles.flex, bg, style]}>
      {header}
      <View style={styles.compactBody}>
        <View style={styles.compactProblem}>{problem}</View>
        {tutorOpen ? (
          <View style={styles.compactTutor}>
            <View style={styles.compactTutorHeader}>
              <Text style={styles.compactTutorTitle}>Tutor</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={i18n.t("learnerStage.hideTutor", "Hide tutor")}
                onPress={() => setTutorOpen(false)}
                hitSlop={10}
              >
                <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            {tutor}
          </View>
        ) : (
          <Pressable
            onPress={() => setTutorOpen(true)}
            style={styles.compactTutorPeek}
            accessibilityRole="button"
            accessibilityLabel="Open tutor"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
            <Text style={styles.compactTutorPeekText}>Tutor</Text>
          </Pressable>
        )}
      </View>

      {scratchpad ? (
        <Pressable
          onPress={() => setScratchOpen((s) => !s)}
          style={styles.scratchFab}
          accessibilityRole="button"
          accessibilityLabel={scratchOpen ? "Close scratchpad" : "Open scratchpad"}
        >
          <Ionicons name={scratchOpen ? "close" : "pencil"} size={22} color={colors.white} />
        </Pressable>
      ) : null}

      {scratchpad && scratchOpen ? (
        <View style={styles.scratchOverlay}>
          <ScratchPad
            compactToolbar
            gridPaper={scratchpadGrid}
            initialStrokes={initialStrokes}
            onChange={onStrokesChange}
          />
        </View>
      ) : null}

      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  threePane: { flex: 1, flexDirection: "row", padding: spacing.md, gap: spacing.md },
  pane: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    overflow: "hidden",
  },
  problemPane: { width: 380 },
  scratchPane: { flex: 1, padding: 0, backgroundColor: "transparent" },
  tutorPane: { width: 360 },

  twoPane: { flex: 1, flexDirection: "row", padding: spacing.md, gap: spacing.md },
  problemPaneMedium: { flex: 1.1 },
  rightStackMedium: { flex: 1, padding: 0, backgroundColor: "transparent", gap: spacing.md },
  scratchPaneMedium: { flex: 1.2 },
  tutorPaneMedium: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    overflow: "hidden",
  },

  compactBody: { flex: 1, padding: spacing.md, gap: spacing.md },
  compactProblem: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    overflow: "hidden",
  },
  compactTutor: {
    maxHeight: 260,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  compactTutorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  compactTutorTitle: { fontSize: 14, fontFamily: "Nunito-Bold", color: colors.text },
  compactTutorPeek: {
    flexDirection: "row",
    alignSelf: "center",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: colors.primary + "14",
  },
  compactTutorPeekText: { fontSize: 13, fontFamily: "Nunito-Bold", color: colors.primary },

  scratchFab: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.md,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: colors.black,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  scratchOverlay: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    top: spacing.md,
    bottom: 80,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    overflow: "hidden",
    elevation: 6,
  },
});
