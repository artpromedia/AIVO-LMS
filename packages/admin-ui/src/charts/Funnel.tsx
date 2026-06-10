"use client";

import { Funnel as RechartsFunnel, FunnelChart, LabelList, Tooltip } from "recharts";
import { CHART_AXIS, CHART_INK, cycleTone, toneColor, type ChartTone } from "./tones.js";

export interface FunnelStage {
  label: string;
  value: number;
}

/** Whole-percent conversion from the previous stage ("" for the first). */
export function stageConversion(stages: readonly FunnelStage[], index: number): string {
  if (index === 0) return "";
  const previous = stages[index - 1]?.value ?? 0;
  if (previous <= 0) return "0%";
  return `${Math.round((stages[index].value / previous) * 100)}%`;
}

interface StageLabelProps {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: unknown;
}

/**
 * Custom label renderers: recharts' own funnel labels width-constrain their
 * <Text> and wrap it at every space, which breaks both the layout and the
 * element's accessible text content. Raw <text> never wraps.
 */
function StageLabel(props: StageLabelProps) {
  const text = String(props.value ?? "");
  if (!text) return null;
  return (
    <text
      x={Number(props.x ?? 0) - 8}
      y={Number(props.y ?? 0) + Number(props.height ?? 0) / 2}
      textAnchor="end"
      dominantBaseline="middle"
      fontSize={12}
      fill={CHART_INK}
    >
      {text}
    </text>
  );
}

function ConversionLabel(props: StageLabelProps) {
  const text = String(props.value ?? "");
  if (!text) return null;
  return (
    <text
      x={Number(props.x ?? 0) + Number(props.width ?? 0) + 8}
      y={Number(props.y ?? 0) + Number(props.height ?? 0) / 2}
      textAnchor="start"
      dominantBaseline="middle"
      fontSize={12}
      fill={CHART_AXIS}
    >
      {text}
    </text>
  );
}

/**
 * Ordered funnel with the conversion percentage from each stage to the
 * next rendered alongside the stage label. Render inside a ChartCard.
 */
export function Funnel({
  stages,
  title,
  description,
  tone,
}: {
  stages: FunnelStage[];
  title: string;
  description: string;
  /** Single tone for every stage; defaults to the tone cycle. */
  tone?: ChartTone;
}) {
  const data = stages.map((stage, index) => ({
    ...stage,
    display: `${stage.label} · ${stage.value.toLocaleString("en-US")}`,
    conversion: stageConversion(stages, index),
    fill: toneColor(tone ?? cycleTone(index)),
  }));
  return (
    <FunnelChart title={title} desc={description} margin={{ top: 8, right: 64, bottom: 8, left: 150 }}>
      <Tooltip />
      <RechartsFunnel dataKey="value" nameKey="label" data={data} isAnimationActive={false}>
        <LabelList position="left" dataKey="display" content={StageLabel} />
        <LabelList position="right" dataKey="conversion" content={ConversionLabel} />
      </RechartsFunnel>
    </FunnelChart>
  );
}
