import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "../theme";
import { barRatios, takeRecent, type ChartPoint } from "./helpers";
import { ChartFrame, type ChartStateProps } from "./ChartFrame";

/**
 * TrendChart — soft vertical bars growing from the floor, the mobile
 * mirror of web's `SoftLine` "lessons by day" panel. Flexbox-based (no
 * SVG / measuring), so it is responsive by construction: each bar takes
 * an equal share of the width on both phone and tablet.
 *
 * Long series are collapsed to `maxBars` most-recent slots so a 30-day
 * history stays legible on a phone.
 */
export interface TrendChartProps extends ChartStateProps {
  data: ReadonlyArray<ChartPoint>;
  /** Plot area height (excludes labels). */
  height?: number;
  /** Bar fill colour. */
  tone?: string;
  /** Cap the number of bars; keeps the most recent. Default 14. */
  maxBars?: number;
  /** Render x labels under the bars. Default true. */
  showLabels?: boolean;
  ariaLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function TrendChart({
  data,
  height = 120,
  tone = theme.colors.primary,
  maxBars = 14,
  showLabels = true,
  ariaLabel = "Trend chart",
  loading,
  error,
  empty,
  style,
}: TrendChartProps) {
  const points = takeRecent(data, maxBars);
  return (
    <ChartFrame
      height={height}
      loading={loading}
      error={error}
      empty={empty || points.length === 0}
      style={style}
    >
      <View accessibilityRole="image" accessibilityLabel={ariaLabel} style={style}>
        <View style={[styles.plot, { height }]}>
          {barRatios(points).map((ratio, i) => (
            <View key={`${points[i].label}-${i}`} style={styles.col}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${Math.max(ratio > 0 ? 4 : 0, ratio * 100)}%`,
                      backgroundColor: tone,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
        {showLabels && (
          <View style={styles.labels}>
            {points.map((p, i) => (
              <Text key={`${p.label}-${i}`} numberOfLines={1} style={styles.label}>
                {p.label}
              </Text>
            ))}
          </View>
        )}
      </View>
    </ChartFrame>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  col: { flex: 1, height: "100%", justifyContent: "flex-end" },
  barTrack: { width: "100%", height: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: theme.radius.sm, minHeight: 2 },
  labels: { flexDirection: "row", gap: 6, marginTop: 6 },
  label: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
  },
});
