"use client";
import { forwardRef } from "react";
import { cn } from "../utils/cn";
import { type MasteryLevel } from "./helpers";

export type MasteryCell = {
  /** Standard / skill code, e.g. "RL.3.1". */
  code: string;
  /** Human-readable name shown on hover. */
  name?: string;
  /** Current mastery level. */
  level: MasteryLevel;
};

export type MasteryHeatStripProps = {
  cells: ReadonlyArray<MasteryCell>;
  /** Cell height in pixels. */
  height?: number;
  /** Optional legend below the strip. */
  showLegend?: boolean;
  className?: string;
  ariaLabel?: string;
  loading?: boolean;
  error?: string;
  empty?: boolean;
};

const CELL_BG: Record<MasteryLevel, string> = {
  emerging: "bg-iw-mastery-emerging-subtle",
  developing: "bg-iw-mastery-developing-subtle",
  proficient: "bg-iw-mastery-proficient-subtle",
  mastered: "bg-iw-mastery-mastered-subtle",
};

const CELL_RING: Record<MasteryLevel, string> = {
  emerging: "ring-iw-mastery-emerging-strong/30",
  developing: "ring-iw-mastery-developing-strong/30",
  proficient: "ring-iw-mastery-proficient-strong/30",
  mastered: "ring-iw-mastery-mastered-strong/40",
};

const LEGEND: Array<{ level: MasteryLevel; label: string }> = [
  { level: "emerging", label: "Emerging" },
  { level: "developing", label: "Developing" },
  { level: "proficient", label: "Proficient" },
  { level: "mastered", label: "Mastered" },
];

/**
 * MasteryHeatStrip — horizontal grid of mastery cells. Each cell maps
 * a standard / skill code to its current mastery level using the
 * semantic.domain.mastery scale.
 */
export const MasteryHeatStrip = forwardRef<HTMLDivElement, MasteryHeatStripProps>(
  function MasteryHeatStrip(
    {
      cells,
      height = 40,
      showLegend = true,
      className,
      ariaLabel = "Mastery overview",
      loading,
      error,
      empty,
    },
    ref,
  ) {
    if (loading) {
      return (
        <div
          ref={ref}
          className={cn(
            "aivo-motion-baseline-gen rounded-iw-card bg-iw-card border border-iw-border",
            className,
          )}
          style={{ height: height + (showLegend ? 28 : 0) }}
          aria-busy="true"
        />
      );
    }
    if (error) {
      return (
        <div
          ref={ref}
          role="alert"
          className={cn(
            "rounded-iw-card border border-iw-error/40 bg-iw-error/5 text-iw-error text-sm px-3 py-2",
            className,
          )}
        >
          {error}
        </div>
      );
    }
    if (empty || cells.length === 0) {
      return (
        <div
          ref={ref}
          className={cn(
            "rounded-iw-card border border-dashed border-iw-border text-iw-text-muted text-sm px-3 py-2",
            className,
          )}
        >
          No mastery data yet
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-2", className)}
        role="group"
        aria-label={ariaLabel}
      >
        <div
          className="grid gap-1 aivo-motion-lesson-reveal"
          style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))`, height }}
        >
          {cells.map((c) => (
            <div
              key={c.code}
              className={cn(
                "rounded-iw-control ring-1 transition-colors",
                CELL_BG[c.level],
                CELL_RING[c.level],
              )}
              title={`${c.code}${c.name ? ` — ${c.name}` : ""}: ${c.level}`}
              aria-label={`${c.code} ${c.level}`}
            />
          ))}
        </div>
        {showLegend && (
          <ul className="flex flex-wrap gap-3 text-xs text-iw-text-muted">
            {LEGEND.map((l) => (
              <li key={l.level} className="inline-flex items-center gap-1.5">
                <span className={cn("inline-block w-3 h-3 rounded-iw-control", CELL_BG[l.level])} />
                <span>{l.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);

MasteryHeatStrip.displayName = "Chart/MasteryHeatStrip";
