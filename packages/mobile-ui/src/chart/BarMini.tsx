/**
 * BarMini — small horizontal comparison bars (e.g. mastery per subject).
 *
 * Renders a stack of 100 %-wide rows, each containing a labelled filled
 * bar proportional to `value / maxValue`. Sensory-palette aware: the
 * brand tone follows `palette.primary` so high-contrast and calm modes
 * render legibly.
 *
 * @example
 * ```tsx
 * const palette = useSensoryPalette();
 * <BarMini
 *   bars={[
 *     { label: "Math", value: 80, maxValue: 100 },
 *     { label: "ELA",  value: 75, maxValue: 100 },
 *   ]}
 *   palette={palette}
 * />
 * ```
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Rect } from "react-native-svg";
import {
  DEFAULT_PALETTE,
  barFillRatios,
  buildBarMiniLabel,
  toneColor,
  toneSoftColor,
  type BarItem,
  type ChartTone,
  type SensoryPalette,
} from "./chartHelpers";

export interface BarMiniProps {
  /** Bar data: each item has a label, a value, and a maxValue. */
  bars: Array<BarItem>;
  /** Subject label used in the accessibility description. */
  subject?: string;
  /** Stroke/fill tone — defaults to brand primary. */
  tone?: ChartTone;
  /**
   * Resolved sensory palette from `useSensoryPalette()`.
   * Defaults to the standard (inclusive-warm) palette.
   */
  palette?: SensoryPalette;
}

const BAR_HEIGHT = 10;
const LABEL_FONT_SIZE = 12;

export function BarMini({
  bars,
  subject = "Subjects",
  tone = "brand",
  palette = DEFAULT_PALETTE,
}: BarMiniProps) {
  const ratios = barFillRatios(bars);
  const a11yLabel = buildBarMiniLabel(bars, subject);
  const fill = toneColor(tone, palette);
  const track = toneSoftColor(tone, palette);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={a11yLabel}
      style={styles.wrap}
    >
      {bars.length === 0 ? (
        <View style={[styles.empty, { borderColor: palette.border }]} />
      ) : (
        bars.map((bar, i) => {
          const ratio = ratios[i];
          const pct = Math.round(ratio * 100);
          return (
            <View key={`${bar.label}-${i}`} style={styles.row}>
              <View style={styles.labelRow}>
                <Text
                  style={[styles.barLabel, { color: palette.ink }]}
                  numberOfLines={1}
                >
                  {bar.label}
                </Text>
                <Text style={[styles.pctLabel, { color: palette.inkMuted }]}>
                  {pct}%
                </Text>
              </View>
              <Svg
                width="100%"
                height={BAR_HEIGHT}
                viewBox="0 0 100 10"
                preserveAspectRatio="none"
                aria-hidden
              >
                {/* Track */}
                <Rect x={0} y={0} width={100} height={BAR_HEIGHT} rx={5} fill={track} />
                {/* Fill */}
                {ratio > 0 && (
                  <Rect
                    x={0}
                    y={0}
                    width={Math.max(4, ratio * 100)}
                    height={BAR_HEIGHT}
                    rx={5}
                    fill={fill}
                  />
                )}
              </Svg>
            </View>
          );
        })
      )}
      {/* Visually-hidden data breakdown for screen-reader context. */}
      <Text
        importantForAccessibility="no"
        accessible={false}
        style={styles.srOnly}
      >
        {bars
          .map(({ label, value, maxValue }) => {
            const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
            return `${label}: ${pct}%`;
          })
          .join(". ")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    gap: 8,
  },
  row: {
    gap: 4,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  barLabel: {
    flex: 1,
    fontSize: LABEL_FONT_SIZE,
    marginRight: 8,
  },
  pctLabel: {
    fontSize: LABEL_FONT_SIZE,
  },
  empty: {
    height: BAR_HEIGHT * 3,
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
