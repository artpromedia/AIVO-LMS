/**
 * Top stage bar — close button, progress dots, optional pause + scratchpad
 * toggles. Sprint 02 lifts it out of the inline [sessionId].tsx to make the
 * stage screen a thin orchestrator.
 *
 * Inclusive-warm refresh (Task #10): drops the raw close/pause Pressables in
 * favour of `HeaderUserChip` + `SensoryToggle variant="icon"` from the shared
 * UI primitives, so sensory-mode switching mid-session re-skins the Stage
 * chrome the same way it does the role dashboards.
 */

import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing } from "@/constants/colors";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { HeaderUserChip, SensoryToggle } from "@/components/ui";

interface Props {
  beatCount: number;
  currentIndex: number;
  userName: string;
  userSubtitle?: string;
  onClose: () => void;
  onPause: () => void;
  scratchpadButton?: React.ReactNode;
  paddingTop: number;
}

export function MobileSessionHeader({
  beatCount,
  currentIndex,
  userName,
  userSubtitle,
  onClose,
  onPause,
  scratchpadButton,
  paddingTop,
}: Props) {
  const palette = useSensoryPalette();
  const styles = createStyles(paddingTop);
  return (
    <View style={styles.topBar}>
      <View style={styles.leftCluster}>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close session"
          style={({ pressed }) => [
            styles.iconBtn,
            {
              backgroundColor: palette.bgRaised,
              borderColor: palette.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons name="close" size={20} color={palette.ink} />
        </Pressable>
        <HeaderUserChip name={userName} subtitle={userSubtitle} />
      </View>

      <View style={styles.progressPath}>
        {Array.from({ length: beatCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              { backgroundColor: palette.primary },
              i === currentIndex && styles.progressDotActive,
              i > currentIndex && styles.progressDotInactive,
            ]}
          />
        ))}
      </View>

      <View style={styles.actions}>
        {scratchpadButton}
        <SensoryToggle variant="icon" />
        <Pressable
          onPress={onPause}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Pause session"
          style={({ pressed }) => [
            styles.iconBtn,
            {
              backgroundColor: palette.bgRaised,
              borderColor: palette.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons name="pause" size={20} color={palette.ink} />
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(paddingTop: number) {
  return StyleSheet.create({
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingTop,
      paddingBottom: 8,
      gap: 12,
    },
    leftCluster: { flexDirection: "row", alignItems: "center", gap: 10 },
    progressPath: { flexDirection: "row", gap: 8, flexShrink: 1 },
    progressDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      opacity: 0.4,
    },
    progressDotActive: { opacity: 1, transform: [{ scale: 1.2 }] },
    progressDotInactive: { opacity: 0.25 },
    actions: { flexDirection: "row", alignItems: "center", gap: 10 },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
