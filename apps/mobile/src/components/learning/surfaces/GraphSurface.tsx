/**
 * Sprint 13 — coordinate-plane graphing (Sprint 5 surface, moved verbatim).
 * Tap the grid to plot a snapped point (tap again to remove); submits the
 * captured points.
 */
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline, Rect } from "react-native-svg";
import { createSurfaceStyles, readNumber, readString } from "./shared";
import type { SurfaceProps } from "./types";

/** Exported for unit tests: snap a raw tap onto the step grid within bounds. */
export function snapTo(value: number, min: number, max: number, step: number): number {
  const stepped = Math.round((value - min) / step) * step + min;
  return Math.max(min, Math.min(max, stepped));
}

export function GraphSurface({ theme, disabled, cfg, onSubmit }: SurfaceProps) {
  const styles = useMemo(() => createSurfaceStyles(theme), [theme]);
  const xMin = readNumber(cfg, "xMin", 0);
  const xMax = readNumber(cfg, "xMax", 10);
  const yMin = readNumber(cfg, "yMin", 0);
  const yMax = readNumber(cfg, "yMax", 10);
  const step = Math.max(1, readNumber(cfg, "step", 1));
  const mode = readString(cfg, "mode", "points");
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);

  const SIZE = 280;
  const PAD = 24;
  const span = SIZE - PAD * 2;
  const sx = (x: number) => PAD + ((x - xMin) / (xMax - xMin || 1)) * span;
  const sy = (y: number) => SIZE - PAD - ((y - yMin) / (yMax - yMin || 1)) * span;

  const ticks = (min: number, max: number) => {
    const out: number[] = [];
    for (let v = min; v <= max; v += step) out.push(v);
    return out;
  };

  return (
    <View style={{ gap: 12 }}>
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel="coordinate grid — tap to plot a point"
        disabled={disabled}
        onPress={(e) => {
          // Svg is rendered at a fixed SIZE×SIZE, so the Pressable's
          // locationX/locationY map 1:1 onto the viewBox coordinates.
          const { locationX, locationY } = e.nativeEvent;
          const rawX = xMin + ((locationX - PAD) / span) * (xMax - xMin);
          const rawY = yMin + ((SIZE - PAD - locationY) / span) * (yMax - yMin);
          const x = snapTo(rawX, xMin, xMax, step);
          const y = snapTo(rawY, yMin, yMax, step);
          setPoints((prev) => {
            const i = prev.findIndex((p) => p.x === x && p.y === y);
            return i >= 0 ? prev.filter((_, idx) => idx !== i) : [...prev, { x, y }];
          });
        }}
        style={{ width: SIZE, height: SIZE, alignSelf: "center" }}
      >
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Rect x={0} y={0} width={SIZE} height={SIZE} fill={theme.colors.surface} />
          {ticks(xMin, xMax).map((x) => (
            <Line
              key={`x${x}`}
              x1={sx(x)}
              y1={PAD}
              x2={sx(x)}
              y2={SIZE - PAD}
              stroke={theme.colors.border}
              strokeWidth={1}
            />
          ))}
          {ticks(yMin, yMax).map((y) => (
            <Line
              key={`y${y}`}
              x1={PAD}
              y1={sy(y)}
              x2={SIZE - PAD}
              y2={sy(y)}
              stroke={theme.colors.border}
              strokeWidth={1}
            />
          ))}
          {mode === "line" && points.length > 1 ? (
            <Polyline
              points={points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")}
              fill="none"
              stroke={theme.colors.primary}
              strokeWidth={2}
            />
          ) : null}
          {points.map((p, i) => (
            <Circle
              key={`${p.x},${p.y},${i}`}
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={6}
              fill={theme.colors.primary}
            />
          ))}
        </Svg>
      </Pressable>
      <Text style={styles.note}>
        {points.length} point{points.length === 1 ? "" : "s"} plotted
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="submit graph"
        disabled={disabled || points.length === 0}
        onPress={() => onSubmit({ kind: "graph", points })}
        style={[styles.submit, (disabled || points.length === 0) && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>I&apos;m done</Text>
      </Pressable>
    </View>
  );
}
