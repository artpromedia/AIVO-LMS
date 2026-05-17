/**
 * StageContent.native.tsx — React Native equivalent of StageContent.tsx
 */
import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import type { Beat, SensoryAdaptations } from "../types.js";

export interface StageContentProps {
  currentBeat: Beat | null;
  adaptations: SensoryAdaptations;
}

export function StageContent({ currentBeat, adaptations }: StageContentProps) {
  if (!currentBeat) return null;

  const fontSize = adaptations?.contrastBoost ? 20 : 16;
  const showSubtitles = adaptations?.useSubtitles ?? false;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      accessible
      accessibilityLabel="Stage content area"
    >
      {currentBeat.narration ? (
        <Text
          style={[styles.narration, { fontSize }]}
          accessibilityRole="text"
          accessibilityLabel={currentBeat.narration}
        >
          {currentBeat.narration}
        </Text>
      ) : null}

      {currentBeat.interaction?.prompt ? (
        <Text
          style={[styles.prompt, { fontSize: fontSize + 2 }]}
          accessibilityRole="header"
        >
          {currentBeat.interaction.prompt}
        </Text>
      ) : null}

      {showSubtitles && currentBeat.narration ? (
        <View style={styles.subtitleBar} accessibilityElementsHidden>
          <Text style={styles.subtitle}>{currentBeat.narration}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  narration: {
    color: "#e2e8f0",
    lineHeight: 26,
    fontWeight: "400",
  },
  prompt: {
    color: "#f8fafc",
    fontWeight: "700",
    lineHeight: 30,
    marginTop: 8,
  },
  subtitleBar: {
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  subtitle: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
  },
});
