import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "../theme";
import type { MasteryLevel } from "./helpers";
import { MASTERY_TONES, MASTERY_LEGEND } from "./tones";
import { ChartFrame, type ChartStateProps } from "./ChartFrame";

export type MasteryCell = {
  /** Standard / skill code, e.g. "RL.3.1". */
  code: string;
  /** Human-readable name (used for the a11y label). */
  name?: string;
  level: MasteryLevel;
};

/**
 * MasteryHeatStrip — horizontal grid of mastery cells, the mobile mirror
 * of web's `MasteryHeatStrip`. Each cell maps a skill/standard code to a
 * mastery level via the `semantic.domain.mastery` scale. Equal-width
 * flex cells keep it responsive on phone and tablet; long strips wrap to
 * the next row.
 */
export interface MasteryHeatStripProps extends ChartStateProps {
  cells: ReadonlyArray<MasteryCell>;
  /** Cell height. */
  height?: number;
  showLegend?: boolean;
  ariaLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function MasteryHeatStrip({
  cells,
  height = 36,
  showLegend = true,
  ariaLabel = "Mastery overview",
  loading,
  error,
  empty,
  style,
}: MasteryHeatStripProps) {
  return (
    <ChartFrame
      height={height}
      loading={loading}
      error={error}
      empty={empty || cells.length === 0}
      emptyLabel="No mastery data yet"
      style={style}
    >
      <View accessibilityRole="summary" accessibilityLabel={ariaLabel} style={[styles.wrap, style]}>
        <View style={styles.strip}>
          {cells.map((c, i) => {
            const tone = MASTERY_TONES[c.level];
            return (
              <View
                key={`${c.code}-${i}`}
                accessibilityLabel={`${c.code}${c.name ? ` ${c.name}` : ""}: ${tone.label}`}
                style={[
                  styles.cell,
                  { height, backgroundColor: tone.track, borderColor: tone.fill + "59" },
                ]}
              />
            );
          })}
        </View>
        {showLegend && (
          <View style={styles.legend}>
            {MASTERY_LEGEND.map((l) => (
              <View key={l.level} style={styles.legendItem}>
                <View
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: MASTERY_TONES[l.level].track,
                      borderColor: MASTERY_TONES[l.level].fill + "59",
                    },
                  ]}
                />
                <Text style={styles.legendLabel}>{l.label}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ChartFrame>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.spacing.sm },
  strip: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  cell: {
    flexGrow: 1,
    flexBasis: 18,
    minWidth: 14,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
  },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3, borderWidth: 1 },
  legendLabel: { fontSize: 11, fontFamily: theme.fonts.body, color: theme.colors.textSecondary },
});
