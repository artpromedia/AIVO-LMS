/**
 * ProgressRing — radial progress indicator.
 *
 * Renders a filled SVG arc whose sweep encodes a 0..1 ratio. Centre text
 * displays the rounded percentage. Sensory-palette aware: the brand tone
 * follows `palette.primary`.
 *
 * @example
 * ```tsx
 * const palette = useSensoryPalette();
 * <ProgressRing value={0.75} label="Course completion" palette={palette} />
 * ```
 */
import React from "react";
import { View } from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import {
  DEFAULT_PALETTE,
  ringDash,
  buildProgressRingLabel,
  toneColor,
  toneSoftColor,
  type ChartTone,
  type SensoryPalette,
} from "./chartHelpers";

export interface ProgressRingProps {
  /** Progress ratio in 0..1. Values outside this range are clamped. */
  value: number;
  /** Human-readable subject used in the accessibility label. */
  label?: string;
  /** Outer diameter of the ring in logical pixels. Default 80. */
  size?: number;
  /** Stroke tone — defaults to brand primary. */
  tone?: ChartTone;
  /**
   * Resolved sensory palette from `useSensoryPalette()`.
   * Defaults to the standard (inclusive-warm) palette.
   */
  palette?: SensoryPalette;
}

export function ProgressRing({
  value,
  label = "Progress",
  size = 80,
  tone = "brand",
  palette = DEFAULT_PALETTE,
}: ProgressRingProps) {
  const strokeWidth = size * 0.1;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;

  const { array: dashArray, offset: dashOffset } = ringDash(value, radius);
  const a11yLabel = buildProgressRingLabel(value, label);
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const stroke = toneColor(tone, palette);
  const trackColor = toneSoftColor(tone, palette);
  const fontSize = Math.max(10, size * 0.22);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={a11yLabel}
      style={{ width: size, height: size }}
    >
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
      >
        {/* Background track ring */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress arc — rotate -90° so it starts at the top */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={dashArray}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        {/* Centre percentage text */}
        <SvgText
          x={cx}
          y={cy + fontSize * 0.36}
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight="700"
          fill={palette.ink}
        >
          {`${pct}%`}
        </SvgText>
      </Svg>
    </View>
  );
}
