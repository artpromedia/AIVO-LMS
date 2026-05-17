/**
 * ProgressPath.tsx — SVG-based progress bar with step dots for web.
 * Matches the React Native variant's visual contract: a 100% wide track,
 * a coloured fill that grows with progress, and a label "X/Y · NXP".
 *
 * Uses an SVG so step dots can be anti-aliased crisply at any DPI without
 * relying on canvas. Reduced-motion users still see the full progress
 * immediately, just without the CSS width transition.
 */
import React from "react";

export interface ProgressPathProps {
  current: number;
  total: number;
  xpEarned: number;
  reducedMotion?: boolean;
}

export function ProgressPath({ current, total, xpEarned, reducedMotion = false }: ProgressPathProps) {
  const safeTotal = total > 0 ? total : 1;
  const progress = Math.min(1, current / safeTotal);
  const widthPct = `${(progress * 100).toFixed(2)}%`;
  const transition = reducedMotion ? "none" : "width 500ms ease";

  // Generate evenly-spaced step dots so the track reads as a path.
  const dotCount = Math.min(safeTotal, 24);
  const dotPositions: number[] = [];
  for (let i = 0; i < dotCount; i++) {
    dotPositions.push(((i + 0.5) / dotCount) * 100);
  }

  return (
    <div
      className="aivo-progress-path"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-label={`Progress: ${current} of ${total} beats completed. ${xpEarned} XP earned.`}
      style={{
        padding: "8px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          position: "relative",
          height: 8,
          backgroundColor: "rgba(255,255,255,0.15)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: widthPct,
            backgroundColor: "#7c3aed",
            borderRadius: 4,
            transition,
          }}
        />
        <svg
          aria-hidden="true"
          width="100%"
          height="8"
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          preserveAspectRatio="none"
          viewBox="0 0 100 8"
        >
          {dotPositions.map((cx, i) => (
            <circle
              key={i}
              cx={cx}
              cy={4}
              r={1.2}
              fill={cx / 100 <= progress ? "#fff" : "rgba(255,255,255,0.4)"}
            />
          ))}
        </svg>
      </div>
      <span aria-hidden="true" style={{ color: "#94a3b8", fontSize: 12, textAlign: "right" }}>
        {current}/{total} · {xpEarned} XP
      </span>
    </div>
  );
}
