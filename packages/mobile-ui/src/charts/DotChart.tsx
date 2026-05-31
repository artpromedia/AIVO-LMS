import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "../theme";
import { valueRatios, takeRecent, type ChartPoint } from "./helpers";
import { ChartFrame, type ChartStateProps } from "./ChartFrame";

/**
 * DotChart — discrete points with no connecting line, the mobile mirror
 * of web's `DotChart`. Each point sits in an equal-width flex column and
 * is positioned vertically by its value ratio (top = highest). Useful
 * for "sessions per day" / "approvals per day" where the trend is
 * implicit. Optional dashed gridlines at 25/50/75%.
 */
export interface DotChartProps extends ChartStateProps {
  data: ReadonlyArray<ChartPoint>;
  height?: number;
  tone?: string;
  dotSize?: number;
  showGrid?: boolean;
  maxDots?: number;
  showLabels?: boolean;
  ariaLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function DotChart({
  data,
  height = 120,
  tone = theme.colors.primary,
  dotSize = 9,
  showGrid = true,
  maxDots = 14,
  showLabels = true,
  ariaLabel = "Dot chart",
  loading,
  error,
  empty,
  style,
}: DotChartProps) {
  const points = takeRecent(data, maxDots);
  const ratios = valueRatios(points);
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
          {showGrid &&
            [0.25, 0.5, 0.75].map((r) => (
              <View
                key={r}
                pointerEvents="none"
                style={[styles.grid, { top: `${(1 - r) * 100}%` }]}
              />
            ))}
          {ratios.map((ratio, i) => (
            <View key={`${points[i].label}-${i}`} style={styles.col}>
              <View
                style={[
                  styles.dot,
                  {
                    width: dotSize,
                    height: dotSize,
                    borderRadius: dotSize / 2,
                    backgroundColor: tone,
                    top: `${(1 - ratio) * 100}%`,
                    marginTop: -dotSize / 2,
                  },
                ]}
              />
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
  plot: { flexDirection: "row", position: "relative" },
  grid: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  col: { flex: 1, height: "100%", alignItems: "center" },
  dot: { position: "absolute" },
  labels: { flexDirection: "row", marginTop: 6 },
  label: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
  },
});
