/**
 * BeatPreview.native.tsx — React Native beat preview card
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { Beat } from "../types.js";

export interface BeatPreviewProps {
  beat: Beat;
  index: number;
  isCurrent?: boolean;
}

export function BeatPreview({ beat, index, isCurrent = false }: BeatPreviewProps) {
  const typeLabel = beat.type.charAt(0).toUpperCase() + beat.type.slice(1);

  return (
    <View
      style={[styles.card, isCurrent && styles.cardCurrent]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Beat ${index + 1}: ${typeLabel}`}
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{index + 1}</Text>
      </View>
      <Text style={[styles.type, isCurrent && styles.typeCurrent]}>{typeLabel}</Text>
      {beat.narration ? (
        <Text style={styles.preview} numberOfLines={2}>
          {beat.narration}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 44, // WCAG 2.5.5 — 44pt touch target
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 12,
    marginVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardCurrent: {
    backgroundColor: "rgba(124,58,237,0.3)",
    borderWidth: 1,
    borderColor: "#7c3aed",
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  type: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  typeCurrent: {
    color: "#c4b5fd",
  },
  preview: {
    color: "#cbd5e1",
    fontSize: 12,
    flex: 2,
  },
});
