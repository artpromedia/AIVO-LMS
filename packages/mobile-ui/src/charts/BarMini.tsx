import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "../theme";
import { ChartFrame, type ChartStateProps } from "./ChartFrame";
import { MASTERY_TONES } from "./tones";
import { masteryLevelFromScore } from "./helpers";

/**
 * BarMini — a compact stacked list of labelled horizontal bars, one per
 * subject/category. Designed to fit inside a child card or dashboard tile as a
 * "subject mastery at a glance" widget. Each bar's fill colour is derived from
 * the mastery level unless an explicit `tone` is provided.
 *
 * `subjects` should be sorted in display order (highest-mastery first is
 * recommended). The component renders at most `maxRows` rows (default 5) to
 * keep the card height predictable.
 *
 * Gracefully degrades when `subjects` is empty by returning `null`.
 */
export interface BarMiniSubject {
  /** Display name (e.g. "Math", "Reading"). */
  name: string;
  /** Score in 0..1 or 0..100. */
  value: number;
  /** Optional override fill colour. */
  tone?: string;
}

export interface BarMiniProps extends ChartStateProps {
  subjects: ReadonlyArray<BarMiniSubject>;
  /** Max rows to render. Default 5. */
  maxRows?: number;
  /** Bar track height in dp. Default 6. */
  barHeight?: number;
  /** Accessible label for screen-readers. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function BarMini({
  subjects,
  maxRows = 5,
  barHeight = 6,
  label = "Subject mastery",
  loading,
  error,
  style,
}: BarMiniProps) {
  if (!loading && !error && subjects.length === 0) return null;

  const rows = subjects.slice(0, maxRows);

  return (
    <ChartFrame
      height={rows.length * (barHeight + 20)}
      loading={loading}
      error={error}
      empty={subjects.length === 0}
      style={style}
    >
      <View accessibilityRole="list" accessibilityLabel={label} style={styles.list}>
        {rows.map((subj) => {
          const pct = subj.value > 1 ? Math.min(subj.value, 100) : Math.min(subj.value * 100, 100);
          const level = masteryLevelFromScore(pct / 100);
          const fill = subj.tone ?? MASTERY_TONES[level].fill;
          const label_pct = `${Math.round(pct)}%`;

          return (
            <View
              key={subj.name}
              style={styles.row}
              accessibilityLabel={`${subj.name} ${label_pct}`}
            >
              <Text style={styles.name} numberOfLines={1}>
                {subj.name}
              </Text>
              <View style={[styles.track, { height: barHeight, borderRadius: barHeight / 2 }]}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${pct > 0 ? Math.max(4, pct) : 0}%`,
                      height: barHeight,
                      borderRadius: barHeight / 2,
                      backgroundColor: fill,
                    },
                  ]}
                />
              </View>
              <Text style={styles.pct}>{label_pct}</Text>
            </View>
          );
        })}
      </View>
    </ChartFrame>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: {
    width: 52,
    fontSize: 11,
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.text,
  },
  track: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSoft,
    overflow: "hidden",
  },
  fill: { minWidth: 0 },
  pct: {
    width: 30,
    fontSize: 11,
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    textAlign: "right",
  },
});
