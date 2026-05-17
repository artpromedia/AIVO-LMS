"use client";
import Image from "next/image";
import { TUTORS } from "@aivo/brand";
import type { TutorKey } from "@aivo/brand";
import type { TutorState, SensoryAdaptations } from "./types";
import { TUTOR_THEMES } from "./types";

interface TutorCharacterProps {
  tutorKey: TutorKey;
  state: TutorState;
  speechText?: string;
  showSubtitles: boolean;
  adaptations: SensoryAdaptations;
}

const STATE_EMOJIS: Record<TutorState, string> = {
  idle: "",
  speaking: "💬",
  celebrating: "🎉",
  thinking: "🤔",
  encouraging: "💪",
  pointing: "👉",
};

export function TutorCharacter({ tutorKey, state, speechText, showSubtitles, adaptations }: TutorCharacterProps) {
  const tutor = TUTORS[tutorKey];
  const theme = TUTOR_THEMES[tutorKey];

  const animationClass =
    state === "idle" ? "animate-breathe" :
    state === "speaking" ? "animate-speak" :
    state === "celebrating" ? "animate-celebrate" :
    state === "thinking" ? "animate-think" :
    state === "encouraging" ? "animate-encourage" :
    state === "pointing" ? "animate-point" : "";

  const stateReaction = STATE_EMOJIS[state];

  return (
    <div className="relative flex flex-col items-center">
      <div
        className={`relative ${adaptations.motionReduced ? "" : animationClass}`}
        style={{ filter: `saturate(${adaptations.colorSaturation}%)` }}
      >
        {stateReaction && (
          <div className="absolute -top-2 -right-2 text-2xl z-10 animate-bounce-gentle">
            {stateReaction}
          </div>
        )}

        <div
          className="relative w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-4 shadow-2xl"
          style={{
            borderColor: theme?.accentColor || tutor.color,
            boxShadow: `0 0 30px ${theme?.accentColor || tutor.color}40`,
          }}
        >
          <Image
            src={tutor.avatar}
            alt={tutor.name}
            fill
            className="object-cover"
            priority
          />
          {state === "speaking" && (
            <div className="absolute inset-0 rounded-full border-4 animate-ping-slow opacity-30"
              style={{ borderColor: theme?.accentColor || tutor.color }} />
          )}
        </div>

        <div className="mt-2 text-center">
          <p className="text-white font-heading font-bold text-sm drop-shadow">{tutor.name}</p>
          <p className="text-white/60 text-xs">{tutor.domain}</p>
        </div>
      </div>

      {speechText && (showSubtitles || state === "speaking") && (
        <div
          className="mt-3 bg-white/95 backdrop-blur rounded-2xl px-4 py-3 max-w-xs shadow-lg relative animate-fade-in"
          style={{ borderLeft: `4px solid ${theme?.accentColor || tutor.color}` }}
        >
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white/95 rotate-45 rounded-sm" />
          <p className="text-slate-800 text-sm font-body leading-relaxed relative z-10">{speechText}</p>
        </div>
      )}
    </div>
  );
}
