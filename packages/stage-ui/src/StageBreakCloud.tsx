/**
 * StageBreakCloud — modal "take a break" overlay shown to learners during a
 * stage session. Offers four self-regulation activities (breathe, listen,
 * stretch, quiet) and a "go home (progress saved)" escape hatch.
 *
 * Extracted from apps/web/src/components/stage/StageBreakCloud.tsx as part of
 * the §8 #2 Stage extraction (v2.1).
 */
"use client";
import { useState } from "react";
import { Cloud, Wind, Music, Flower2, Home, type LucideIcon } from "lucide-react";

type BreakActivity = "breathe" | "music" | "stretch" | "quiet";

export interface StageBreakCloudProps {
  isOpen: boolean;
  onClose: () => void;
  onPause: () => void;
  onHome?: () => void;
}

const BREAK_OPTIONS: { id: BreakActivity; Icon: LucideIcon; label: string; description: string }[] = [
  { id: "breathe", Icon: Wind, label: "Breathe", description: "Slow, calm breaths" },
  { id: "music", Icon: Music, label: "Listen", description: "Relaxing sounds" },
  { id: "stretch", Icon: Flower2, label: "Stretch", description: "Gentle movement" },
  { id: "quiet", Icon: Cloud, label: "Just sit", description: "Quiet moment" },
];

export function StageBreakCloud({ isOpen, onClose, onPause: _onPause, onHome }: StageBreakCloudProps) {
  const [activity, setActivity] = useState<BreakActivity | null>(null);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Break options"
    >
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-sky-100 text-sky-500 flex items-center justify-center" aria-hidden="true">
            <Cloud className="w-8 h-8" strokeWidth={2} />
          </div>
          <h2 className="text-2xl font-heading font-bold text-slate-800">Take a break</h2>
          <p className="text-slate-500 mt-1">Your lesson is paused</p>
        </div>

        {!activity ? (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {BREAK_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setActivity(option.id)}
                  className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-sky-50 border-2 border-transparent hover:border-sky-300 hover:bg-sky-100 transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sky-400"
                  style={{ minHeight: "var(--learner-hit-target, 72px)" }}
                >
                  <option.Icon className="w-8 h-8 text-sky-600" strokeWidth={2} aria-hidden="true" />
                  <span className="font-heading font-bold text-sky-800">{option.label}</span>
                  <span className="text-xs text-sky-600">{option.description}</span>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <button
                onClick={() => { setActivity(null); onClose(); }}
                className="w-full px-6 py-3 rounded-2xl bg-purple-100 text-purple-700 font-heading font-bold hover:bg-purple-200 transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-purple-400"
                style={{ minHeight: "var(--learner-hit-target, 48px)" }}
              >
                Keep going
              </button>
              {onHome && (
                <button
                  onClick={onHome}
                  className="w-full px-6 py-3 rounded-2xl bg-slate-100 text-slate-600 font-heading font-bold hover:bg-slate-200 transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-slate-400 inline-flex items-center justify-center gap-2"
                  style={{ minHeight: "var(--learner-hit-target, 48px)" }}
                >
                  <Home className="w-4 h-4" strokeWidth={2.5} aria-hidden /> Go home (progress saved)
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-sky-50 text-sky-500 flex items-center justify-center" aria-hidden="true">
                {(() => { const opt = BREAK_OPTIONS.find((o) => o.id === activity); if (!opt) return null; const I = opt.Icon; return <I className="w-12 h-12" strokeWidth={2} />; })()}
              </div>
              <p className="text-lg font-heading font-bold text-slate-700 mb-2">
                {activity === "breathe" && "Breathe in slowly... hold... breathe out..."}
                {activity === "music" && "Close your eyes and listen..."}
                {activity === "stretch" && "Reach up high, then gently touch your toes..."}
                {activity === "quiet" && "It's okay to just sit quietly. Take as long as you need."}
              </p>
              <p className="text-sm text-slate-400 mt-4">Take as long as you need</p>
            </div>
            <button
              onClick={() => { setActivity(null); onClose(); }}
              className="w-full px-6 py-3 rounded-2xl bg-purple-600 text-white font-heading font-bold hover:bg-purple-700 transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-purple-400"
              style={{ minHeight: "var(--learner-hit-target, 48px)" }}
            >
              I&apos;m ready to go back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
