"use client";
import { Check } from "lucide-react";

/**
 * Tier-aware section-progress journey graphic.
 *
 * Renders a curving path with one stop per section. Completed stops glow
 * with the tier accent, the current stop is highlighted with the tier
 * primary, and upcoming stops are de-emphasised. Used above the existing
 * `SectionProgressChips` on the parent assessment screen so the parent
 * has a "where am I in the trail" mental model rather than just chip
 * states.
 *
 * Pure presentation: takes section labels + current index + per-section
 * completeness, no internal state.
 */
export interface JourneySection {
  key: string;
  label: string;
  shortLabel: string;
  icon?: string;
}

interface SectionJourneyGraphicProps {
  sections: JourneySection[];
  currentIdx: number;
  /** Per-section completion booleans, parallel array to `sections`. */
  completed: boolean[];
  /** Optional jump handler; renders stops as buttons if provided. */
  onJump?: (idx: number) => void;
}

export default function SectionJourneyGraphic({
  sections,
  currentIdx,
  completed,
  onJump,
}: SectionJourneyGraphicProps) {
  if (sections.length === 0) return null;

  // Layout: evenly spaced along a sinusoidal path so the journey reads as
  // a trail rather than a flat progress bar.
  const W = 100;
  const H = 28;
  const stops = sections.map((_, i) => {
    const t = sections.length === 1 ? 0.5 : i / (sections.length - 1);
    const x = 4 + t * (W - 8);
    // Gentle wave: stops alternate above/below the centerline.
    const y = H / 2 + Math.sin(t * Math.PI * 1.4) * 7;
    return { x, y };
  });

  // Build path data threading through all stops, with quadratic curves so
  // the trail reads continuously instead of segment-by-segment.
  const pathD = stops
    .map((p, i) => {
      if (i === 0) return `M ${p.x},${p.y}`;
      const prev = stops[i - 1];
      const cx = (prev.x + p.x) / 2;
      const cy = (prev.y + p.y) / 2;
      return `Q ${cx},${prev.y} ${cx},${cy} T ${p.x},${p.y}`;
    })
    .join(" ");

  // Where on the path the "you are here" indicator sits — bisect between
  // the last completed stop and the current stop for a smooth read.
  const overallProgress = sections.length === 1 ? 1 : currentIdx / (sections.length - 1);

  return (
    <div
      className="relative w-full"
      role="group"
      aria-label={`Assessment journey, on section ${Math.min(currentIdx + 1, sections.length)} of ${sections.length}`}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-16 sm:h-20"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {/* Background trail */}
        <path
          d={pathD}
          fill="none"
          stroke="color-mix(in srgb, var(--tier-primary, #7C3AED) 18%, transparent)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeDasharray="0.5 1.5"
        />
        {/* Completed segment of the trail */}
        <path
          d={pathD}
          fill="none"
          stroke="var(--tier-primary, #7C3AED)"
          strokeWidth="1.6"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${overallProgress} 1`}
        />
        {stops.map((p, i) => {
          const isComplete = completed[i];
          const isCurrent = i === currentIdx;
          const fill = isComplete
            ? "var(--tier-accent, #FFB700)"
            : isCurrent
              ? "var(--tier-primary, #7C3AED)"
              : "color-mix(in srgb, var(--tier-primary, #7C3AED) 18%, transparent)";
          const stroke = isCurrent ? "var(--tier-primary, #7C3AED)" : "rgba(255,255,255,0.85)";
          return (
            <g key={sections[i].key}>
              {isCurrent && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="3.4"
                  fill="none"
                  stroke="var(--tier-primary, #7C3AED)"
                  strokeWidth="0.6"
                  opacity="0.5"
                  style={{
                    animation: "journey-pulse calc(2s * var(--tier-pace, 1)) ease-in-out infinite",
                    transformOrigin: `${p.x}px ${p.y}px`,
                  }}
                />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={isCurrent ? 2.2 : 1.8}
                fill={fill}
                stroke={stroke}
                strokeWidth="0.4"
              />
            </g>
          );
        })}
      </svg>

      {/* Per-stop labels (a11y + visible reading order). Rendered as a
          screen-reader-friendly list under the SVG, with the visible
          icons sitting just below their dot via absolute positioning. */}
      <div className="relative -mt-2 sm:-mt-3 h-5 text-[10px] font-bold">
        {sections.map((s, i) => {
          const stop = stops[i];
          const isComplete = completed[i];
          const isCurrent = i === currentIdx;
          const Tag = onJump ? "button" : "span";
          const tone = isComplete
            ? "var(--tier-accent, #FFB700)"
            : isCurrent
              ? "var(--tier-primary, #7C3AED)"
              : "var(--tier-text-soft, #5C5067)";
          return (
            <Tag
              key={s.key}
              {...(onJump
                ? {
                    type: "button" as const,
                    onClick: () => onJump(i),
                    "aria-current": isCurrent ? ("step" as const) : undefined,
                    "aria-label": `Jump to ${s.label}${isComplete ? " (completed)" : ""}`,
                  }
                : {})}
              className="absolute -translate-x-1/2 inline-flex items-center gap-0.5 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--tier-primary,#7C3AED)_50%,transparent)] rounded px-0.5"
              style={{ left: `${stop.x}%`, color: tone }}
            >
              {s.icon && <span aria-hidden>{s.icon}</span>}
              <span className="hidden sm:inline">{s.shortLabel}</span>
              {isComplete && <Check className="w-2.5 h-2.5" aria-hidden strokeWidth={3} />}
            </Tag>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes journey-pulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.4);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
