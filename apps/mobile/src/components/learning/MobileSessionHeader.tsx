/**
 * Top stage bar — close button, progress dots, optional pause + scratchpad
 * toggles. Sprint 02 lifts it out of the inline [sessionId].tsx to make the
 * stage screen a thin orchestrator.
 */

import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { TierThemeMobile } from "@aivo/mobile-ui";
import { spacing } from "@/constants/colors";

interface Props {
  theme: TierThemeMobile;
  beatCount: number;
  currentIndex: number;
  onClose: () => void;
  onPause: () => void;
  scratchpadButton?: React.ReactNode;
  paddingTop: number;
}

export function MobileSessionHeader({
  theme,
  beatCount,
  currentIndex,
  onClose,
  onPause,
  scratchpadButton,
  paddingTop,
}: Props) {
  const styles = createStyles(theme, paddingTop);
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close session">
        <Ionicons name="close" size={28} color={theme.colors.text} />
      </Pressable>
      <View style={styles.progressPath}>
        {Array.from({ length: beatCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              i === currentIndex && styles.progressDotActive,
              i > currentIndex && styles.progressDotInactive,
            ]}
          />
        ))}
      </View>
      <View style={styles.actions}>
        {scratchpadButton}
        <Pressable onPress={onPause} hitSlop={12} accessibilityLabel="Pause session">
          <Ionicons name="pause" size={28} color={theme.colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(theme: TierThemeMobile, paddingTop: number) {
  return StyleSheet.create({
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingTop,
      paddingBottom: 8,
    },
    progressPath: { flexDirection: "row", gap: 8 },
    progressDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.primary,
      opacity: 0.4,
    },
    progressDotActive: { opacity: 1, transform: [{ scale: 1.2 }] },
    progressDotInactive: { opacity: 0.25 },
    actions: { flexDirection: "row", alignItems: "center", gap: 16 },
  });
}
