/**
 * Tutor mascot panel — emoji avatar + speech bubble. Hidden in HIGH tier
 * voice-only mode.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { TierThemeMobile } from "@aivo/mobile-ui";

interface Props {
  theme: TierThemeMobile;
  tier: "EARLY" | "MIDDLE" | "HIGH";
  message: string;
}

export function MobileTutorPanel({ theme, tier, message }: Props) {
  if (tier === "HIGH") return null;
  const styles = createStyles(theme);
  return (
    <View style={styles.tutorArea}>
      <View style={styles.tutorCircle}>
        <Text style={{ fontSize: tier === "EARLY" ? 44 : 36 }}>
          {tier === "EARLY" ? "🦊" : "🌙"}
        </Text>
      </View>
      <View style={styles.speechBubble}>
        <Text style={styles.speechText} accessibilityRole="text">
          {message}
        </Text>
      </View>
    </View>
  );
}

function createStyles(theme: TierThemeMobile) {
  return StyleSheet.create({
    tutorArea: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
    tutorCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    speechBubble: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 12,
    },
    speechText: { color: theme.colors.text, fontSize: 16, lineHeight: 22 },
  });
}
