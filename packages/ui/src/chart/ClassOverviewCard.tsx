"use client";
import { forwardRef, type ReactNode } from "react";
import { Users } from "lucide-react";
import { cn } from "../utils/cn";
import { GlassCard } from "../surface/GlassCard";
import { MasteryHeatStrip, type MasteryCell } from "./MasteryHeatStrip";
import { RiskIndicator } from "./RiskIndicator";
import { type RiskLevel } from "./helpers";

export type ClassOverviewCardProps = {
  /** Class display name, e.g. "Grade 3 — Reading". */
  className: string;
  /** Total roster count. */
  studentCount: number;
  /** Per-standard mastery cells (one row, condensed). */
  mastery: ReadonlyArray<MasteryCell>;
  /** Highest current risk for the class. */
  risk: RiskLevel;
  /** Short risk explanation, e.g. "3 students slipping in fluency". */
  riskNote?: string;
  /** Optional right-aligned actions slot. */
  actions?: ReactNode;
  className_?: string;
};

/**
 * ClassOverviewCard — compact composite used on teacher home and school
 * admin dashboards. Wraps GlassCard + MasteryHeatStrip + RiskIndicator.
 */
export const ClassOverviewCard = forwardRef<HTMLDivElement, ClassOverviewCardProps>(
  function ClassOverviewCard(
    { className: classDisplayName, studentCount, mastery, risk, riskNote, actions, className_ },
    ref,
  ) {
    return (
      <GlassCard ref={ref} density="base" radius="card-lg" className={cn(className_)}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-iw-text-strong truncate">
              {classDisplayName}
            </h3>
            <p className="text-xs text-iw-text-muted inline-flex items-center gap-1.5 mt-0.5">
              <Users className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="iw-tabular">{studentCount}</span>
              <span>students</span>
            </p>
          </div>
          <RiskIndicator level={risk} label={riskLabel(risk)} detail={riskNote} size="sm" />
        </div>
        <MasteryHeatStrip cells={mastery} height={28} showLegend={false} />
        {actions && <div className="mt-4 flex flex-wrap gap-2 justify-end">{actions}</div>}
      </GlassCard>
    );
  },
);

ClassOverviewCard.displayName = "Chart/ClassOverviewCard";

function riskLabel(level: RiskLevel): string {
  switch (level) {
    case "low":
      return "On track";
    case "watch":
      return "Watch";
    case "elevated":
      return "Elevated";
    case "high":
      return "High";
  }
}
