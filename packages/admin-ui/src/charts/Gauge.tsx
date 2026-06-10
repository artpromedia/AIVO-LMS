"use client";

import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";
import { CHART_AXIS, CHART_GRID, CHART_INK, toneColor, type ChartTone } from "./tones.js";

/**
 * Radial gauge for a 0..1 ratio (completion rate, utilization, …). The
 * formatted center label defaults to a whole-number percentage; pass `label`
 * for a custom (already formatted) reading. The center label carries
 * data-testid="gauge-center-label" (registered in e2e/lib/fixtures.ts).
 * Render inside a ChartCard (a square-ish aspect works best).
 */
export function Gauge({
  ratio,
  title,
  description,
  label,
  caption,
  tone = "primary",
}: {
  /** 0..1; values outside the range are clamped. */
  ratio: number;
  title: string;
  description: string;
  /** Formatted center label. Defaults to `Math.round(ratio * 100)%`. */
  label?: string;
  /** Small caption under the center label, e.g. "completion". */
  caption?: string;
  tone?: ChartTone;
}) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const display = label ?? `${Math.round(clamped * 100)}%`;
  return (
    <RadialBarChart
      data={[{ value: clamped * 100 }]}
      startAngle={225}
      endAngle={-45}
      innerRadius="70%"
      outerRadius="100%"
      title={title}
      desc={description}
    >
      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
      <RadialBar
        dataKey="value"
        background={{ fill: CHART_GRID }}
        cornerRadius={8}
        fill={toneColor(tone)}
        isAnimationActive={false}
      />
      <text
        x="50%"
        y={caption ? "47%" : "50%"}
        textAnchor="middle"
        dominantBaseline="middle"
        data-testid="gauge-center-label"
        style={{ fontSize: 28, fontWeight: 600, fill: CHART_INK, fontVariantNumeric: "tabular-nums" }}
      >
        {display}
      </text>
      {caption ? (
        <text
          x="50%"
          y="58%"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: 12, fill: CHART_AXIS }}
        >
          {caption}
        </text>
      ) : null}
    </RadialBarChart>
  );
}
