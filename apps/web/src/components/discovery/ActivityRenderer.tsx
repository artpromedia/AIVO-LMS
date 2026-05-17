"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Check, Heart } from "lucide-react";
import { TUTORS } from "@aivo/brand";
import type { Activity, AdventureChapter, ActivityChoice } from "./types";
import { IconWell, colorForTutor, VI_COLOR, VI_TINT } from "./_vi";
import { playCorrectCue, playIncorrectCue } from "@/lib/audio";
import { useTutorVoice } from "@/lib/useTutorVoice";
import Mascot from "@/components/Mascot";

interface ActivityRendererProps {
  activity: Activity;
  chapter: AdventureChapter;
  activityNumber: number;
  totalActivities: number;
  onAnswer: (correct: boolean, latencyMs: number) => void;
  onSkip: () => void;
}

export default function ActivityRenderer({
  activity, chapter, activityNumber, totalActivities, onAnswer,
}: ActivityRendererProps) {
  const [phase, setPhase] = useState<"narrating" | "interacting" | "feedback">("narrating");
  const [selected, setSelected] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showChoices, setShowChoices] = useState(false);
  const promptStartRef = useRef<number>(Date.now());
  const tutor = TUTORS[chapter.tutorKey];
  const subjectKey = colorForTutor(tutor?.color);
  const subjectColor = VI_COLOR[subjectKey];
  const subjectTint = VI_TINT[subjectKey];

  // Speak the narration during the narrating phase, then the tutor line
  // once choices are showing. Mute toggle and reduced-motion fallback live
  // inside the hook so call sites don't repeat the gating.
  useTutorVoice(phase === "narrating" ? activity.narration : null);
  useTutorVoice(phase !== "narrating" && showChoices ? activity.tutorLine : null);

  useEffect(() => {
    setPhase("narrating");
    setSelected(null);
    setIsCorrect(null);
    setShowChoices(false);
    const t1 = setTimeout(() => { setPhase("interacting"); promptStartRef.current = Date.now(); }, 2500);
    const t2 = setTimeout(() => setShowChoices(true), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [activity.id]);

  const handleSelect = (choice: ActivityChoice) => {
    if (selected) return;
    setSelected(choice.id);
    setIsCorrect(choice.isCorrect);
    setPhase("feedback");
    const latency = Date.now() - promptStartRef.current;
    if (choice.isCorrect) playCorrectCue();
    else playIncorrectCue();
    setTimeout(() => onAnswer(choice.isCorrect, latency), 1800);
  };

  return (
    <div className="fixed inset-0 vi-bg tier-scene-bg flex flex-col overflow-hidden pt-20">
      <div className="max-w-3xl mx-auto w-full px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>{chapter.landmark.emoji}</span>
          <span className="text-slate-600 text-xs font-extrabold">{chapter.title}</span>
        </div>
        <div className="flex items-center gap-1.5" role="progressbar" aria-valuenow={activityNumber} aria-valuemax={totalActivities}>
          {Array.from({ length: totalActivities }).map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i < activityNumber - 1 ? "w-6 bg-[hsl(262_83%_58%)]"
                  : i === activityNumber - 1 ? "w-8 bg-[hsl(262_83%_58%)]"
                  : "w-2 bg-slate-200"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 relative overflow-y-auto py-4">
        {phase === "feedback" && isCorrect !== null && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div
              className="vi-card text-center px-8 py-6"
              style={{
                borderColor: isCorrect ? "hsl(142 71% 45% / 0.3)" : "hsl(43 100% 50% / 0.3)",
                background: isCorrect ? "hsl(142 71% 45% / 0.06)" : "hsl(43 100% 50% / 0.06)",
              }}
            >
              <div className="mx-auto mb-2 inline-flex">
                {isCorrect ? (
                  <Mascot mood="cheer" size={72} label="Great job!" />
                ) : (
                  <IconWell color="sel" size="md">
                    <Heart className="w-7 h-7" strokeWidth={2.5} />
                  </IconWell>
                )}
              </div>
              <p className="text-xl font-extrabold text-slate-900">{isCorrect ? "Amazing!" : "Good try!"}</p>
              <p className="text-sm text-slate-600 mt-1">{isCorrect ? "You got it right!" : "The adventure continues!"}</p>
            </div>
          </div>
        )}

        <div className={`transition-all duration-700 ${phase === "narrating" ? "opacity-100 scale-100" : "opacity-0 scale-95 absolute"}`}>
          <div className="flex flex-col items-center gap-4 max-w-sm mx-auto text-center">
            <div className="w-24 h-24 rounded-3xl overflow-hidden border-4 shadow-lg animate-bounce-gentle" style={{ borderColor: subjectColor }}>
              <Image src={tutor.avatar} alt={tutor.name} width={96} height={96} className="object-cover" />
            </div>
            <div className="vi-card px-6 py-4" style={{ background: subjectTint, borderColor: `${subjectColor}26` }}>
              <p className="text-slate-800 text-base leading-relaxed">{activity.narration}</p>
            </div>
          </div>
        </div>

        {phase !== "narrating" && (
          <div className="w-full max-w-lg space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 shrink-0" style={{ borderColor: subjectColor }}>
                <Image src={tutor.avatar} alt={tutor.name} width={48} height={48} className="object-cover" />
              </div>
              <div className="vi-card px-5 py-3 flex-1" style={{ background: subjectTint, borderColor: `${subjectColor}26` }}>
                <p className="text-slate-800 text-sm">{activity.tutorLine}</p>
              </div>
            </div>

            <div className="text-center text-5xl mb-2" aria-hidden>{activity.sceneEmoji}</div>

            <div
              className={`grid grid-cols-2 gap-3 transition-all duration-500 ${showChoices ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
            >
              {(activity.choices || []).map((choice, idx) => {
                const isSelected = selected === choice.id;
                const isWrong = isSelected && !choice.isCorrect;
                const isRight = selected !== null && choice.isCorrect;
                return (
                  <button
                    key={choice.id}
                    onClick={() => handleSelect(choice)}
                    disabled={selected !== null}
                    className={`relative vi-card p-4 text-center transition-all duration-300 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(262_83%_58%)] focus-visible:ring-offset-2 ${
                      isRight ? "scale-105" : isWrong ? "scale-95 opacity-50" : isSelected ? "" : "hover:scale-105 active:scale-95"
                    }`}
                    style={{
                      borderColor: isRight ? "hsl(142 71% 45%)" : isWrong ? "hsl(0 72% 51%)" : isSelected ? subjectColor : undefined,
                      background: isRight ? "hsl(142 71% 45% / 0.08)" : isWrong ? "hsl(0 72% 51% / 0.08)" : undefined,
                      animationDelay: `${idx * 100}ms`,
                    }}
                  >
                    {choice.emoji && <div className="text-3xl mb-2" aria-hidden>{choice.emoji}</div>}
                    <p className="text-slate-900 font-extrabold text-sm">{choice.label}</p>
                    {isRight && (
                      <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[hsl(142_71%_45%)] flex items-center justify-center text-white shadow-md">
                        <Check className="w-4 h-4" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
