/**
 * Sprint 13 — tap segments to shade them; submits the fraction (moved
 * verbatim; the denominator clamp from the monolith's dispatch site lives
 * here now: 1..12, default 4).
 */
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { createSurfaceStyles, readNumber } from "./shared";
import type { SurfaceProps } from "./types";

export function FractionBarSurface({ theme, disabled, cfg, onSubmit }: SurfaceProps) {
  const styles = useMemo(() => createSurfaceStyles(theme), [theme]);
  const denominator = Math.max(1, Math.min(12, readNumber(cfg, "denominator", 4)));
  const [shaded, setShaded] = useState<Set<number>>(() => new Set());
  const toggle = useCallback(
    (i: number) => {
      if (disabled) return;
      setShaded((prev) => {
        const next = new Set(prev);
        if (next.has(i)) next.delete(i);
        else next.add(i);
        return next;
      });
    },
    [disabled],
  );
  const numerator = shaded.size;
  const canSubmit = numerator > 0 && !disabled;
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.fractionBar}>
        {Array.from({ length: denominator }).map((_, i) => {
          const isShaded = shaded.has(i);
          return (
            <Pressable
              key={i}
              onPress={() => toggle(i)}
              accessibilityRole="button"
              accessibilityLabel={`Segment ${i + 1} of ${denominator}`}
              accessibilityState={{ selected: isShaded, disabled: !!disabled }}
              style={[
                styles.fractionSegment,
                isShaded && styles.fractionSegmentShaded,
                i === 0 && styles.fractionSegmentFirst,
                i === denominator - 1 && styles.fractionSegmentLast,
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.fractionLabel}>
        {numerator} / {denominator}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => onSubmit({ kind: "fraction_bar", numerator, denominator })}
        disabled={!canSubmit}
        style={[styles.submit, !canSubmit && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>
          {numerator === 0 ? "Shade some pieces" : `Submit ${numerator}/${denominator}`}
        </Text>
      </Pressable>
    </View>
  );
}
