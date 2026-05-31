import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "../theme";
import { normalizeScore, masteryLevelFromScore } from "./helpers";
import { MASTERY_TONES } from "./tones";

/**
 * MasteryBar — a labelled horizontal progress strip. The mobile mirror
 * of the bar used across web's `SubjectCard` / `ProgressCurve`. RN can't
 * paint a circular ring without an SVG dependency, so — matching the
 * convention already set by `MobileSubjectCard` — we render a tactile
 * horizontal strip instead.
 *
 * `value` accepts either 0..1 or 0..100. When `tone` is omitted the
 * fill colour is derived from the mastery level of the score.
 */
export interface MasteryBarProps {
  /** Row label (e.g. subject or skill name). */
  label?: string;
  /** Score in 0..1 or 0..100. */
  value: number;
  /** Small caption under the bar (e.g. "Proficient"). */
  caption?: string;
  /** Override the fill colour; defaults to the mastery-level tone. */
  tone?: string;
  /** Bar thickness. */
  height?: number;
  /** Show the percentage on the right of the label row. Default true. */
  showValue?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function MasteryBar({
  label,
  value,
  caption,
  tone,
  height = 10,
  showValue = true,
  style,
}: MasteryBarProps) {
  const ratio = normalizeScore(value);
  const pct = Math.round(ratio * 100);
  const fill = tone ?? MASTERY_TONES[masteryLevelFromScore(value)].fill;

  return (
    <View
      style={[styles.wrap, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      accessibilityLabel={label ? `${label}: ${pct}%` : `${pct}%`}
    >
      {(label || showValue) && (
        <View style={styles.labelRow}>
          {label ? (
            <Text style={styles.label} numberOfLines={1}>
              {label}
            </Text>
          ) : (
            <View />
          )}
          {showValue && <Text style={styles.value}>{pct}%</Text>}
        </View>
      )}
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.max(ratio > 0 ? 4 : 0, pct)}%`,
              height,
              borderRadius: height / 2,
              backgroundColor: fill,
            },
          ]}
        />
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: {
    flex: 1,
    fontSize: 14,
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.text,
    marginRight: theme.spacing.sm,
  },
  value: { fontSize: 13, fontFamily: theme.fonts.bodyBold, color: theme.colors.textSecondary },
  track: { width: "100%", backgroundColor: theme.colors.surfaceSoft, overflow: "hidden" },
  fill: { minWidth: 0 },
  caption: { fontSize: 12, fontFamily: theme.fonts.body, color: theme.colors.textSecondary },
});
