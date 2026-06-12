/**
 * Sprint 13 — tap a tick to mark a value (moved verbatim; the min/max/step
 * parsing the monolith did at its dispatch site lives here now, same
 * defaults and clamps).
 */
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { createSurfaceStyles, readNumber } from "./shared";
import type { SurfaceProps } from "./types";

/** Visible tick list; clamped to avoid runaway arrays from hostile config
 *  (e.g. min=0, max=10000, step=1). Exported for unit tests. */
export function buildTicks(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  if (max <= min) return [min];
  const safeStep = step > 0 ? step : 1;
  const count = Math.min(50, Math.floor((max - min) / safeStep) + 1);
  for (let i = 0; i < count; i++) out.push(min + i * safeStep);
  return out;
}

export function NumberLineSurface({ theme, disabled, cfg, onSubmit }: SurfaceProps) {
  const styles = useMemo(() => createSurfaceStyles(theme), [theme]);
  const min = readNumber(cfg, "min", 0);
  const max = readNumber(cfg, "max", 10);
  const step = Math.max(1, readNumber(cfg, "step", 1));
  const [selected, setSelected] = useState<number | null>(null);
  const ticks = useMemo(() => buildTicks(min, max, step), [min, max, step]);

  return (
    <View style={{ gap: 12 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {ticks.map((n) => {
          const isSelected = selected === n;
          return (
            <Pressable
              key={n}
              onPress={() => !disabled && setSelected(n)}
              accessibilityRole="button"
              accessibilityLabel={`Pick ${n}`}
              accessibilityState={{ selected: isSelected, disabled: !!disabled }}
              style={[styles.tick, isSelected && styles.tickSelected]}
            >
              <Text style={[styles.tickText, isSelected && styles.tickTextSelected]}>{n}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        onPress={() => selected !== null && onSubmit({ kind: "number_line", value: selected })}
        disabled={selected === null || disabled}
        style={[styles.submit, (selected === null || disabled) && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>
          {selected === null ? "Tap a number" : `Submit ${selected}`}
        </Text>
      </Pressable>
    </View>
  );
}
