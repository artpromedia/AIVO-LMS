"use client";
import React, { useState } from "react";

export type BreakActivity = "breathe" | "music" | "stretch" | "quiet";

export interface BreakCloudProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectActivity?: (activity: BreakActivity) => void;
  className?: string;
}

const BREAK_OPTIONS: { id: BreakActivity; icon: string; label: string; description: string }[] = [
  { id: "breathe", icon: "🌬️", label: "Breathe", description: "Slow, calm breaths" },
  { id: "music", icon: "🎵", label: "Listen", description: "Relaxing sounds" },
  { id: "stretch", icon: "🧘", label: "Stretch", description: "Gentle movement" },
  { id: "quiet", icon: "☁️", label: "Just sit", description: "Quiet moment" },
];

export function BreakCloud({ isOpen, onClose, onSelectActivity, className = "" }: BreakCloudProps) {
  const [selectedActivity, setSelectedActivity] = useState<BreakActivity | null>(null);

  if (!isOpen) return null;

  const handleSelect = (activity: BreakActivity) => {
    setSelectedActivity(activity);
    onSelectActivity?.(activity);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm ${className}`}
      role="dialog"
      aria-modal="true"
      aria-label="Take a break"
    >
      <div
        className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4"
        style={{ transitionDuration: "var(--learner-motion-ms, 300ms)" }}
      >
        <div className="text-center mb-6">
          <div className="text-5xl mb-3" aria-hidden="true">
            ☁️
          </div>
          <h2 className="text-2xl font-heading font-bold text-slate-800">Take a break</h2>
          <p className="text-slate-500 mt-1">What would you like to do?</p>
        </div>

        {!selectedActivity ? (
          <div className="grid grid-cols-2 gap-3">
            {BREAK_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => handleSelect(option.id)}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-sky-50 border-2 border-transparent hover:border-sky-300 hover:bg-sky-100 transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sky-400"
                style={{ minHeight: "var(--learner-hit-target, 72px)" }}
              >
                <span className="text-3xl" aria-hidden="true">
                  {option.icon}
                </span>
                <span className="font-heading font-bold text-sky-800">{option.label}</span>
                <span className="text-xs text-sky-600">{option.description}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="text-6xl mb-4" aria-hidden="true">
              {BREAK_OPTIONS.find((o) => o.id === selectedActivity)?.icon}
            </div>
            <p className="text-lg font-heading font-bold text-slate-700 mb-2">
              {selectedActivity === "breathe" && "Breathe in... breathe out..."}
              {selectedActivity === "music" && "Close your eyes and listen..."}
              {selectedActivity === "stretch" && "Reach up high, then touch your toes..."}
              {selectedActivity === "quiet" && "It's okay to just sit quietly..."}
            </p>
            <p className="text-sm text-slate-400">Take as long as you need</p>
          </div>
        )}

        <button
          onClick={() => {
            setSelectedActivity(null);
            onClose();
          }}
          className="w-full mt-6 px-6 py-3 rounded-2xl bg-purple-100 text-purple-700 font-heading font-bold hover:bg-purple-200 transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-purple-400"
          style={{ minHeight: "var(--learner-hit-target, 48px)" }}
        >
          {selectedActivity ? "I'm ready to go back" : "Never mind, let's keep going"}
        </button>
      </div>
    </div>
  );
}
