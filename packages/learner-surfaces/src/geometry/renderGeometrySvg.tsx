import type { CSSProperties } from "react";
import type { GeometryDiagramSpec, GeometryShape, SurfaceAccessibilitySpec } from "../types.js";
import { toPointString } from "./primitives.js";

export interface RenderGeometrySvgProps {
  diagram: GeometryDiagramSpec;
  accessibility: SurfaceAccessibilitySpec;
  className?: string;
  style?: CSSProperties;
}

function renderBackground(diagram: GeometryDiagramSpec, width: number, height: number) {
  if (diagram.coordinateSystem === "grid" || diagram.coordinateSystem === "cartesian") {
    return (
      <g aria-hidden="true" stroke="#e2e8f0" strokeWidth={1}>
        {Array.from({ length: Math.floor(width / 20) + 1 }).map((_, index) => (
          <line key={`grid-v-${index}`} x1={index * 20} y1={0} x2={index * 20} y2={height} />
        ))}
        {Array.from({ length: Math.floor(height / 20) + 1 }).map((_, index) => (
          <line key={`grid-h-${index}`} x1={0} y1={index * 20} x2={width} y2={index * 20} />
        ))}
        {diagram.coordinateSystem === "cartesian" ? (
          <>
            <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="#94a3b8" strokeWidth={1.5} />
            <line x1={width / 2} y1={0} x2={width / 2} y2={height} stroke="#94a3b8" strokeWidth={1.5} />
          </>
        ) : null}
      </g>
    );
  }

  return null;
}

function renderRay(shape: Extract<GeometryShape, { kind: "ray" }>, width: number, height: number) {
  const dx = shape.through.x - shape.start.x;
  const dy = shape.through.y - shape.start.y;
  const magnitude = Math.hypot(dx, dy) || 1;
  const ux = dx / magnitude;
  const uy = dy / magnitude;
  const extension = Math.max(width, height) * 2;

  return (
    <line
      x1={shape.start.x}
      y1={shape.start.y}
      x2={shape.start.x + ux * extension}
      y2={shape.start.y + uy * extension}
      stroke={shape.stroke ?? "#1f2937"}
      strokeWidth={2}
    />
  );
}

function renderAngle(shape: Extract<GeometryShape, { kind: "angle" }>) {
  const radius = 20;
  const angleA = Math.atan2(shape.armA.y - shape.vertex.y, shape.armA.x - shape.vertex.x);
  const angleB = Math.atan2(shape.armB.y - shape.vertex.y, shape.armB.x - shape.vertex.x);
  const startX = shape.vertex.x + radius * Math.cos(angleA);
  const startY = shape.vertex.y + radius * Math.sin(angleA);
  const endX = shape.vertex.x + radius * Math.cos(angleB);
  const endY = shape.vertex.y + radius * Math.sin(angleB);
  const sweepFlag = angleB - angleA >= 0 ? 1 : 0;

  return (
    <g>
      <line x1={shape.vertex.x} y1={shape.vertex.y} x2={shape.armA.x} y2={shape.armA.y} stroke={shape.stroke ?? "#1f2937"} strokeWidth={2} />
      <line x1={shape.vertex.x} y1={shape.vertex.y} x2={shape.armB.x} y2={shape.armB.y} stroke={shape.stroke ?? "#1f2937"} strokeWidth={2} />
      <path
        d={`M ${startX} ${startY} A ${radius} ${radius} 0 0 ${sweepFlag} ${endX} ${endY}`}
        fill="none"
        stroke={shape.stroke ?? "#1f2937"}
        strokeWidth={2}
      />
      {shape.label ? <text x={shape.vertex.x + radius + 6} y={shape.vertex.y - 6}>{shape.label}</text> : null}
    </g>
  );
}

function renderShape(shape: GeometryShape, width: number, height: number) {
  switch (shape.kind) {
    case "triangle":
    case "polygon":
      return (
        <polygon
          points={toPointString(shape.points)}
          fill={shape.fill ?? "transparent"}
          stroke={shape.stroke ?? "#1f2937"}
          strokeWidth={2}
        />
      );
    case "rectangle":
      return (
        <rect
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          fill={shape.fill ?? "transparent"}
          stroke={shape.stroke ?? "#1f2937"}
          strokeWidth={2}
        />
      );
    case "circle":
      return (
        <circle
          cx={shape.cx}
          cy={shape.cy}
          r={shape.r}
          fill={shape.fill ?? "transparent"}
          stroke={shape.stroke ?? "#1f2937"}
          strokeWidth={2}
        />
      );
    case "segment":
      return <line x1={shape.start.x} y1={shape.start.y} x2={shape.end.x} y2={shape.end.y} stroke={shape.stroke ?? "#1f2937"} strokeWidth={2} />;
    case "ray":
      return renderRay(shape, width, height);
    case "angle":
      return renderAngle(shape);
  }
}

export function renderGeometrySvg({ diagram, accessibility, className, style }: RenderGeometrySvgProps) {
  const width = diagram.width ?? 480;
  const height = diagram.height ?? 320;
  const title = accessibility.altText;
  const description = accessibility.screenReaderSummary ?? accessibility.altText;

  return (
    <svg
      role="img"
      aria-label={title}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ maxWidth: "100%", height: "auto", ...style }}
    >
      <title>{title}</title>
      <desc>{description}</desc>
      {renderBackground(diagram, width, height)}
      {diagram.shapes.map((shape) => (
        <g key={shape.id}>{renderShape(shape, width, height)}</g>
      ))}
      {(diagram.labels ?? []).map((label) => (
        <text key={label.id} x={label.position.x} y={label.position.y} fill="#111827" fontSize={14}>
          {label.text}
        </text>
      ))}
      {(diagram.measurements ?? []).map((measurement) => (
        <text key={measurement.id} x={measurement.position.x} y={measurement.position.y} fill="#1d4ed8" fontSize={13}>
          {measurement.text}
        </text>
      ))}
    </svg>
  );
}
