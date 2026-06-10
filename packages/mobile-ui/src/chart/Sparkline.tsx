/**
 * Sparkline — compact SVG trend line for mobile KPI tiles.
 *
 * Built on `react-native-svg` so it renders a true polyline rather than
 * a View-based approximation. Sensory-palette aware: the brand tone
 * tracks `palette.primary` so it shifts correctly in high-contrast and
 * calm modes.
 *
 * @example
 * ```tsx
 * const palette = useSensoryPalette();
 * <Sparkline series={[2, 3, 5, 4, 6, 7, 5]} label="Sessions" palette={palette} />
 * ```
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import {
  DEFAULT_PALETTE,
  sparklinePoints,
  buildSparklineLabel,
  sparklineTrendText,
  toneColor,
  type ChartTone,
  type SensoryPalette,
} from "./chartHelpers";

export interface SparklineProps {
  /** Numeric data series (e.g. sessions per day, score history). */
  series: Array<number>;
  /** Human-readable subject for the accessibility label. */
  label?: string;
  /** Stroke tone — defaults to the brand primary colour. */
  tone?: ChartTone;
  /**
   * Resolved sensory palette from `useSensoryPalette()`.
   * Defaults to the standard (inclusive-warm) palette.
   */
  palette?: SensoryPalette;
}

const VIEW_BOX_W = 100;
const VIEW_BOX_H = 40;

export function Sparkline({
  series,
  label = "Trend",
  tone = "brand",
  palette = DEFAULT_PALETTE,
}: SparklineProps) {
  const points = sparklinePoints(series, VIEW_BOX_W, VIEW_BOX_H);
  const a11yLabel = buildSparklineLabel(series, label);
  const trendText = sparklineTrendText(series);
  const stroke = toneColor(tone, palette);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={a11yLabel}
      style={styles.wrap}
    >
      {series.length > 0 ? (
        <Svg
          viewBox={`0 0 ${VIEW_BOX_W} ${VIEW_BOX_H}`}
          width="100%"
          height={VIEW_BOX_H}
          aria-hidden
        >
          <Polyline
            points={points}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : (
        <View style={[styles.empty, { borderColor: palette.border }]} />
      )}
      {/* Visually-hidden trend description for screen-reader context. */}
      <Text
        importantForAccessibility="no"
        accessible={false}
        style={styles.srOnly}
      >
        {trendText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  empty: {
    height: VIEW_BOX_H,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 4,
  },
  srOnly: {
    width: 1,
    height: 1,
    overflow: "hidden",
    opacity: 0,
    position: "absolute",
  },
});
