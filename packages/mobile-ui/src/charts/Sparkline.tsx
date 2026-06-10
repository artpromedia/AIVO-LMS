import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "../theme";
import { ChartFrame, type ChartStateProps } from "./ChartFrame";

/**
 * Sparkline — a compact inline mini-chart showing a numeric trend series as
 * small vertical bars. Intentionally tiny (default 32 px tall) so it fits
 * inside a StatTile without disrupting the layout. The longest bar always
 * fills the full height; shorter bars are proportional.
 *
 * Accepts either `series: number[]` (raw values) or `data: ChartPoint[]`
 * (label+value) for convenience. `label` / `ariaLabel` set the
 * `accessibilityLabel` on the containing view so screen-reader users
 * receive a meaningful description.
 *
 * Gracefully renders nothing (returns `null`) when `series` is empty or
 * all-zero, so callers don't need to guard the prop.
 */
export interface SparklineProps extends ChartStateProps {
  /** Raw numeric series (latest value at the end). */
  series: ReadonlyArray<number>;
  /** Fill colour for the bars. Defaults to the theme primary. */
  tone?: string;
  /** Bar area height in dp. Default 32. */
  height?: number;
  /** Gap between bars in dp. Default 2. */
  gap?: number;
  /** Accessible description surfaced to screen-readers. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function Sparkline({
  series,
  tone = theme.colors.primary,
  height = 32,
  gap = 2,
  label = "Trend sparkline",
  loading,
  error,
  style,
}: SparklineProps) {
  if (!loading && !error && series.length === 0) return null;

  const max = series.reduce((m, v) => (v > m ? v : m), 1);
  const ratios = series.map((v) => Math.max(v > 0 ? 0.08 : 0, v / max));

  return (
    <ChartFrame height={height} loading={loading} error={error} empty={series.length === 0} style={style}>
      <View
        accessibilityRole="image"
        accessibilityLabel={label}
        style={[styles.row, { height, gap }]}
      >
        {ratios.map((ratio, i) => (
          <View key={i} style={[styles.col, { height }]}>
            <View
              style={[
                styles.bar,
                {
                  height: `${ratio * 100}%`,
                  backgroundColor: tone,
                  opacity: 0.55 + ratio * 0.45,
                },
              ]}
            />
          </View>
        ))}
      </View>
    </ChartFrame>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end" },
  col: { flex: 1, justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: theme.radius.sm, minHeight: 2 },
});
