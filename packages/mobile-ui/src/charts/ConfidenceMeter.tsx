import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "../theme";
import { normalizeScore } from "./helpers";

/**
 * ConfidenceMeter — a small segmented meter for "confidence" style
 * values (0..1 or 0..100), used on the gradebook per-skill rows. Filled
 * segments communicate the value without a precise axis.
 */
export interface ConfidenceMeterProps {
  /** 0..1 or 0..100. */
  value: number;
  /** Number of segments. Default 5. */
  segments?: number;
  tone?: string;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function ConfidenceMeter({
  value,
  segments = 5,
  tone = theme.colors.accent,
  label,
  style,
}: ConfidenceMeterProps) {
  const ratio = normalizeScore(value);
  const filled = Math.round(ratio * segments);
  const pct = Math.round(ratio * 100);
  return (
    <View
      style={[styles.wrap, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      accessibilityLabel={label ? `${label}: ${pct}%` : `${pct}%`}
    >
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.segments}>
        {Array.from({ length: segments }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              { backgroundColor: i < filled ? tone : theme.colors.surfaceSoft },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  label: { fontSize: 12, fontFamily: theme.fonts.body, color: theme.colors.textSecondary },
  segments: { flexDirection: "row", gap: 3 },
  segment: { flex: 1, height: 6, borderRadius: 3 },
});
