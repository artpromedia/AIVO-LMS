"use client";
import React from "react";

import { SEMANTIC } from "@aivo/brand";
export interface NextAction {
  type: "lesson" | "break" | "checkin" | "quest" | "assessment";
  tutorKey?: string;
  tutorName?: string;
  tutorColor?: string;
  tutorIcon?: string;
  title: string;
  subtitle?: string;
  lessonTopic?: string;
  resumeAt?: number;
}

export interface PrimarySlotProps {
  action: NextAction | null;
  loading?: boolean;
  onStart: () => void;
  onBreak: () => void;
  className?: string;
}

export function PrimarySlot({
  action,
  loading,
  onStart,
  onBreak,
  className = "",
}: PrimarySlotProps) {
  if (loading) {
    return (
      <div className={`max-w-2xl mx-auto px-6 py-8 text-center ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded-full w-48 mx-auto" />
          <div className="h-4 bg-slate-100 rounded-full w-32 mx-auto" />
          <div className="flex justify-center gap-3">
            <div className="h-12 w-32 bg-slate-200 rounded-2xl" />
            <div className="h-12 w-32 bg-slate-100 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!action) {
    return (
      <div className={`max-w-2xl mx-auto px-6 py-8 text-center ${className}`}>
        <div className="text-4xl mb-3" aria-hidden="true">
          🌟
        </div>
        <h2 className="text-xl font-heading font-bold text-slate-800">All caught up!</h2>
        <p className="text-slate-500 mt-1">Pick a tutor below to keep learning</p>
      </div>
    );
  }

  return (
    <div className={`max-w-2xl mx-auto px-6 py-8 ${className}`}>
      <div
        className="rounded-3xl p-6 text-center border-2 shadow-lg"
        style={{
          borderColor: action.tutorColor || SEMANTIC.color.text.accent,
          background: `linear-gradient(135deg, ${action.tutorColor || SEMANTIC.color.text.accent}08, ${action.tutorColor || SEMANTIC.color.text.accent}15)`,
        }}
      >
        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Next Up</p>
        <div className="flex items-center justify-center gap-2 mb-2">
          {action.tutorIcon && (
            <span className="text-2xl" aria-hidden="true">
              {action.tutorIcon}
            </span>
          )}
          <h2
            className="text-xl md:text-2xl font-heading font-bold"
            style={{ color: action.tutorColor || "#1E293B" }}
          >
            {action.title}
          </h2>
        </div>
        {action.subtitle && <p className="text-slate-500 mb-4">{action.subtitle}</p>}
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={onStart}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl text-white font-heading font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2"
            style={{
              background: `linear-gradient(135deg, ${action.tutorColor || SEMANTIC.color.text.accent}, ${action.tutorColor || SEMANTIC.color.text.accent}cc)`,
              minHeight: "var(--learner-hit-target, 48px)",
              transitionDuration: "var(--learner-motion-ms, 300ms)",
            }}
          >
            <span aria-hidden="true">▶</span>
            <span>{action.resumeAt ? "Continue" : "Start"}</span>
          </button>
          <button
            onClick={onBreak}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-sky-50 text-sky-700 font-heading font-bold border border-sky-200 hover:bg-sky-100 transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2"
            style={{
              minHeight: "var(--learner-hit-target, 48px)",
              transitionDuration: "var(--learner-motion-ms, 300ms)",
            }}
          >
            <span aria-hidden="true">☁️</span>
            <span>Take a break</span>
          </button>
        </div>
      </div>
    </div>
  );
}
