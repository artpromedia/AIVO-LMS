import React, { useMemo } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Polygon,
  Polyline,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import { colors, radius } from "@/constants/colors";

export type GeometryShape =
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; label?: string; color?: string }
  | {
      kind: "segment";
      from: [number, number];
      to: [number, number];
      color?: string;
      dashed?: boolean;
    }
  | {
      kind: "circle";
      cx: number;
      cy: number;
      r: number;
      color?: string;
      fill?: string;
      label?: string;
    }
  | {
      kind: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      color?: string;
      fill?: string;
      label?: string;
    }
  | { kind: "polygon"; points: [number, number][]; color?: string; fill?: string; label?: string }
  | {
      kind: "angle";
      vertex: [number, number];
      a: [number, number];
      b: [number, number];
      label?: string;
    }
  | {
      kind: "numberLine";
      min: number;
      max: number;
      step: number;
      marks?: number[];
      highlight?: number;
    }
  | { kind: "point"; x: number; y: number; label?: string; color?: string }
  | { kind: "text"; x: number; y: number; text: string; color?: string; fontSize?: number };

export interface GeometryCanvasProps {
  width: number;
  height: number;
  shapes: GeometryShape[];
  /** Show a coordinate grid behind the shapes. */
  grid?: boolean;
  /** Show numeric axes (only useful with grid). */
  axes?: boolean;
  /** Background colour. */
  background?: string;
  style?: ViewStyle;
}

/**
 * Pure SVG geometry renderer for AIVO learning surfaces.
 *
 * Tutor responses can return a normalised list of shapes which renders
 * identically across phones, tablets, and the web app. The renderer is
 * intentionally stateless — interactivity is the responsibility of the
 * parent (e.g. drag-to-construct, snap-to-grid) and lives in a future
 * tablet-specific shell.
 */
export function GeometryCanvas({
  width,
  height,
  shapes,
  grid = false,
  axes = false,
  background = "#FFFFFF",
  style,
}: GeometryCanvasProps) {
  const gridLines = useMemo(() => {
    if (!grid) return null;
    const step = 20;
    const lines: React.ReactNode[] = [];
    for (let x = 0; x <= width; x += step) {
      lines.push(
        <Line key={`vx-${x}`} x1={x} y1={0} x2={x} y2={height} stroke="#E5E7EB" strokeWidth={1} />,
      );
    }
    for (let y = 0; y <= height; y += step) {
      lines.push(
        <Line key={`hy-${y}`} x1={0} y1={y} x2={width} y2={y} stroke="#E5E7EB" strokeWidth={1} />,
      );
    }
    if (axes) {
      const midX = Math.round(width / 2);
      const midY = Math.round(height / 2);
      lines.push(
        <Line key="ax" x1={0} y1={midY} x2={width} y2={midY} stroke="#9CA3AF" strokeWidth={1.5} />,
        <Line key="ay" x1={midX} y1={0} x2={midX} y2={height} stroke="#9CA3AF" strokeWidth={1.5} />,
      );
    }
    return lines;
  }, [grid, axes, width, height]);

  return (
    <View style={[styles.container, { backgroundColor: background }, style]}>
      <Svg width={width} height={height}>
        {gridLines}
        {shapes.map((shape, i) => renderShape(shape, i))}
      </Svg>
    </View>
  );
}

function renderShape(shape: GeometryShape, key: number): React.ReactNode {
  switch (shape.kind) {
    case "line":
      return (
        <G key={key}>
          <Line
            x1={shape.x1}
            y1={shape.y1}
            x2={shape.x2}
            y2={shape.y2}
            stroke={shape.color || colors.primary}
            strokeWidth={2}
          />
          {shape.label ? (
            <SvgText
              x={(shape.x1 + shape.x2) / 2}
              y={(shape.y1 + shape.y2) / 2 - 6}
              fontSize={12}
              fill={colors.text}
              textAnchor="middle"
            >
              {shape.label}
            </SvgText>
          ) : null}
        </G>
      );
    case "segment":
      return (
        <Line
          key={key}
          x1={shape.from[0]}
          y1={shape.from[1]}
          x2={shape.to[0]}
          y2={shape.to[1]}
          stroke={shape.color || colors.primary}
          strokeWidth={2}
          strokeDasharray={shape.dashed ? "6,4" : undefined}
        />
      );
    case "circle":
      return (
        <G key={key}>
          <Circle
            cx={shape.cx}
            cy={shape.cy}
            r={shape.r}
            stroke={shape.color || colors.primary}
            strokeWidth={2}
            fill={shape.fill || "transparent"}
          />
          {shape.label ? (
            <SvgText
              x={shape.cx}
              y={shape.cy}
              fontSize={12}
              fill={colors.text}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {shape.label}
            </SvgText>
          ) : null}
        </G>
      );
    case "rect":
      return (
        <G key={key}>
          <Rect
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            stroke={shape.color || colors.primary}
            strokeWidth={2}
            fill={shape.fill || "transparent"}
          />
          {shape.label ? (
            <SvgText
              x={shape.x + shape.width / 2}
              y={shape.y + shape.height / 2}
              fontSize={12}
              fill={colors.text}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {shape.label}
            </SvgText>
          ) : null}
        </G>
      );
    case "polygon":
      return (
        <Polygon
          key={key}
          points={shape.points.map(([x, y]) => `${x},${y}`).join(" ")}
          stroke={shape.color || colors.primary}
          strokeWidth={2}
          fill={shape.fill || "transparent"}
        />
      );
    case "angle": {
      const { vertex, a, b, label } = shape;
      return (
        <G key={key}>
          <Polyline
            points={`${a[0]},${a[1]} ${vertex[0]},${vertex[1]} ${b[0]},${b[1]}`}
            stroke={colors.primary}
            strokeWidth={2}
            fill="none"
          />
          {label ? (
            <SvgText x={vertex[0] + 12} y={vertex[1] - 4} fontSize={12} fill={colors.text}>
              {label}
            </SvgText>
          ) : null}
        </G>
      );
    }
    case "numberLine": {
      const { min, max, step, marks, highlight } = shape;
      const padding = 20;
      // Use an inline viewport-relative coordinate system: callers may
      // place the number line by wrapping the canvas in a fixed-size view.
      const w = 320; // base width; canvas scales via SVG
      const span = max - min;
      const xAt = (v: number) => padding + ((v - min) / span) * (w - padding * 2);
      const y = 40;
      const ticks: React.ReactNode[] = [];
      for (let v = min; v <= max; v += step) {
        const x = xAt(v);
        const isMark = marks?.includes(v);
        ticks.push(
          <Line
            key={`t-${v}`}
            x1={x}
            y1={y - 6}
            x2={x}
            y2={y + 6}
            stroke={colors.text}
            strokeWidth={isMark ? 2 : 1}
          />,
          <SvgText
            key={`tx-${v}`}
            x={x}
            y={y + 22}
            fontSize={10}
            fill={colors.text}
            textAnchor="middle"
          >
            {v}
          </SvgText>,
        );
      }
      return (
        <G key={key}>
          <Line x1={padding} y1={y} x2={w - padding} y2={y} stroke={colors.text} strokeWidth={2} />
          {ticks}
          {highlight != null ? (
            <Circle cx={xAt(highlight)} cy={y} r={8} fill={colors.primary} />
          ) : null}
        </G>
      );
    }
    case "point":
      return (
        <G key={key}>
          <Circle cx={shape.x} cy={shape.y} r={5} fill={shape.color || colors.primary} />
          {shape.label ? (
            <SvgText x={shape.x + 8} y={shape.y - 6} fontSize={12} fill={colors.text}>
              {shape.label}
            </SvgText>
          ) : null}
        </G>
      );
    case "text":
      return (
        <SvgText
          key={key}
          x={shape.x}
          y={shape.y}
          fontSize={shape.fontSize || 14}
          fill={shape.color || colors.text}
        >
          {shape.text}
        </SvgText>
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
});
