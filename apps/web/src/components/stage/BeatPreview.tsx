"use client";
import { useEffect, useState } from "react";
import { BookOpen, Hand, Eye, PartyPopper, ArrowRight, type LucideIcon } from "lucide-react";
import type { Beat } from "./types";

interface BeatPreviewProps {
  beat: Beat;
  tutorName: string;
  accentColor: string;
  autoAdvanceMs?: number;
  onReady: () => void;
}

export function BeatPreview({ beat, tutorName, accentColor, autoAdvanceMs = 2000, onReady }: BeatPreviewProps) {
  const [interacted, setInteracted] = useState(false);

  useEffect(() => {
    if (!autoAdvanceMs || interacted) return;
    const timer = setTimeout(onReady, autoAdvanceMs);
    return () => clearTimeout(timer);
  }, [autoAdvanceMs, interacted, onReady]);

  const beatTitle = (() => {
    if (beat.type === "narration") return "Story time";
    if (beat.type === "interaction") {
      if (beat.interaction?.type === "multiple_choice") return "Question";
      if (beat.interaction?.type === "drag_drop") return "Drag & match";
      if (beat.interaction?.type === "voice") return "Speak up";
      if (beat.interaction?.type === "draw") return "Draw it";
      if (beat.interaction?.type === "tap") return "Tap it";
      if (beat.interaction?.type === "match") return "Match it";
      return "Activity";
    }
    if (beat.type === "demonstration") return "Watch this";
    if (beat.type === "celebration") return "Celebration!";
    return "Next";
  })();

  const BeatIcon: LucideIcon = (() => {
    if (beat.type === "narration") return BookOpen;
    if (beat.type === "interaction") return Hand;
    if (beat.type === "demonstration") return Eye;
    if (beat.type === "celebration") return PartyPopper;
    return ArrowRight;
  })();

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center animate-scale-in"
        role="alert"
        aria-label={`Coming up: ${beatTitle}`}
      >
        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${accentColor}1f`, color: accentColor }} aria-hidden="true">
          <BeatIcon className="w-8 h-8" strokeWidth={2} />
        </div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Coming up</p>
        <h3 className="text-xl font-heading font-bold mb-1" style={{ color: accentColor }}>
          {beatTitle}
        </h3>
        <p className="text-sm text-slate-500 mb-5">with {tutorName}</p>
        <button
          onClick={() => {
            setInteracted(true);
            onReady();
          }}
          className="px-8 py-3 rounded-2xl text-white font-heading font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2"
          style={{
            background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
            minHeight: "var(--learner-hit-target, 48px)",
          }}
        >
          I'm ready!
        </button>
      </div>
    </div>
  );
}
