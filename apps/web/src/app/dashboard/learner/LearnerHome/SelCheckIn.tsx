"use client";
import { useState } from "react";
import { Heart, X, Smile, Meh, Frown, Angry, Moon, Sparkles } from "lucide-react";
import { useFlVariant, LearnerCard } from "@aivo/learner-ui";
import { useTranslations } from "next-intl";

interface SelExercise {
  title: string;
  steps: string[];
  durationMinutes: number;
}

type EmotionKey = "happy" | "okay" | "sad" | "frustrated" | "tired" | "excited";

const EMOTIONS: { Icon: typeof Smile; labelKey: EmotionKey; value: string; tint: string }[] = [
  { Icon: Smile, labelKey: "happy", value: "happy", tint: "text-emerald-500" },
  { Icon: Meh, labelKey: "okay", value: "okay", tint: "text-slate-500" },
  { Icon: Frown, labelKey: "sad", value: "sad", tint: "text-sky-500" },
  { Icon: Angry, labelKey: "frustrated", value: "frustrated", tint: "text-rose-500" },
  { Icon: Moon, labelKey: "tired", value: "tired", tint: "text-indigo-500" },
  { Icon: Sparkles, labelKey: "excited", value: "excited", tint: "text-amber-500" },
];

interface SelCheckInProps {
  onCheckin: (emotion: string) => Promise<SelExercise | null>;
}

export function SelCheckIn({ onCheckin }: SelCheckInProps) {
  const { isLow } = useFlVariant();
  const t = useTranslations("learner");
  const tc = useTranslations("common");
  const [isOpen, setIsOpen] = useState(false);
  const [exercise, setExercise] = useState<SelExercise | null>(null);

  const visibleEmotions = isLow ? EMOTIONS.slice(0, 4) : EMOTIONS;

  const handleSelect = async (emotion: string) => {
    setIsOpen(false);
    const result = await onCheckin(emotion);
    if (result) setExercise(result);
  };

  if (exercise) {
    return (
      <LearnerCard
        className="max-w-lg mx-auto"
        variant="bordered"
        accentColor="hsl(var(--visual-sel))"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Heart
              className="w-5 h-5 text-[hsl(var(--visual-sel))] fill-[hsl(var(--visual-sel))]"
              aria-hidden
            />
            <h3 className="font-extrabold text-lg text-slate-900">{exercise.title}</h3>
          </div>
          <button
            onClick={() => setExercise(null)}
            aria-label={tc("close")}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--visual-sel))]"
          >
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
        <ol className="space-y-2">
          {exercise.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))] text-xs font-extrabold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-sm text-slate-700">{step}</span>
            </li>
          ))}
        </ol>
        <div className="text-xs text-slate-500 mt-3 font-semibold">
          {t("minutes_count", { count: exercise.durationMinutes })}
        </div>
      </LearnerCard>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-2 rounded-full bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))] font-extrabold hover:bg-[hsl(var(--visual-sel)/0.22)] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--visual-sel))] ${
          isLow ? "px-7 py-3 text-lg" : "px-5 py-2.5 text-sm"
        }`}
        style={{ minHeight: "var(--learner-hit-target, 44px)" }}
        aria-expanded={isOpen}
      >
        <Heart className="w-4 h-4 fill-[hsl(var(--visual-sel))]" aria-hidden />{" "}
        {t("feeling_prompt")}
      </button>
      {isOpen && (
        <div
          className="flex gap-2 flex-wrap justify-center vi-card p-3"
          role="radiogroup"
          aria-label={t("feeling_prompt")}
        >
          {visibleEmotions.map((e) => {
            const Icon = e.Icon;
            const label = t(`emotion_${e.labelKey}` as const);
            return (
              <button
                key={e.value}
                onClick={() => handleSelect(e.value)}
                role="radio"
                aria-checked={false}
                className={`hover:scale-110 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--visual-sel))] rounded-2xl bg-slate-50 hover:bg-white border border-slate-100 flex items-center justify-center ${e.tint} ${
                  isLow ? "p-3" : "p-2"
                }`}
                title={label}
                aria-label={label}
                style={{
                  minHeight: "var(--learner-hit-target, 48px)",
                  minWidth: "var(--learner-hit-target, 48px)",
                }}
              >
                <Icon className={isLow ? "w-9 h-9" : "w-6 h-6"} strokeWidth={2.25} aria-hidden />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
