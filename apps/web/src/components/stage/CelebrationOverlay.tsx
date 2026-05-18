"use client";
import { useEffect, useState } from "react";
import { Trophy, Star, Sparkles, PartyPopper, Award } from "lucide-react";
import type { SensoryAdaptations } from "./types";

const CONFETTI_ICONS = [Star, Sparkles, Sparkles, Sparkles, PartyPopper, PartyPopper];

interface CelebrationOverlayProps {
  xpEarned: number;
  coinsEarned: number;
  correctCount: number;
  totalAttempts: number;
  streakCount?: number;
  newBadges?: string[];
  adaptations: SensoryAdaptations;
  accentColor: string;
  tutorName: string;
  onComplete: () => void;
}

export function CelebrationOverlay({
  xpEarned,
  coinsEarned,
  correctCount,
  totalAttempts,
  streakCount,
  newBadges,
  adaptations,
  accentColor,
  tutorName,
  onComplete,
}: CelebrationOverlayProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const speed = adaptations.motionReduced ? 2000 : 1200;
    const t1 = setTimeout(() => setPhase(1), speed);
    const t2 = setTimeout(() => setPhase(2), speed * 2);
    const t3 = setTimeout(() => setPhase(3), speed * 3);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [adaptations.motionReduced]);

  const accuracy = totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 100;
  const stars = accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      {!adaptations.motionReduced && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => {
            const Icon = CONFETTI_ICONS[i % CONFETTI_ICONS.length];
            return (
              <div
                key={i}
                className="absolute animate-confetti"
                style={{
                  left: `${(i * 5 + 2) % 100}%`,
                  animationDelay: `${(i * 0.1) % 2}s`,
                  animationDuration: `${2 + (i % 4) * 0.5}s`,
                }}
              >
                <Icon
                  className="w-6 h-6 text-amber-400 fill-amber-300"
                  strokeWidth={2}
                  aria-hidden
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl space-y-5 animate-scale-in">
        <div className="space-y-2">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-100 text-amber-500 flex items-center justify-center">
            {stars === 3 ? (
              <Trophy className="w-10 h-10" strokeWidth={2} aria-hidden />
            ) : stars === 2 ? (
              <Sparkles className="w-10 h-10" strokeWidth={2} aria-hidden />
            ) : (
              <Star className="w-10 h-10" strokeWidth={2} aria-hidden />
            )}
          </div>
          <h2 className="text-2xl font-heading font-bold text-slate-900">
            {stars === 3 ? "Amazing!" : stars === 2 ? "Great Job!" : "Good Effort!"}
          </h2>
          <p className="text-sm text-slate-500 font-body">Session with {tutorName} complete</p>
        </div>

        <div className="flex justify-center gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <span
              key={i}
              className={`transition-all duration-500 ${
                i < stars ? "scale-100 opacity-100" : "scale-75 opacity-30"
              }`}
              style={{ transitionDelay: `${i * 300}ms` }}
            >
              <Star
                className={`w-8 h-8 ${i < stars ? "text-amber-400 fill-amber-300" : "text-slate-300"}`}
                strokeWidth={2}
                aria-hidden
              />
            </span>
          ))}
        </div>

        {phase >= 1 && (
          <div className="flex justify-center gap-6 animate-fade-in">
            <div className="text-center">
              <div className="text-2xl font-bold font-heading" style={{ color: accentColor }}>
                +{xpEarned}
              </div>
              <div className="text-xs text-slate-400 font-body">XP</div>
            </div>
            {coinsEarned > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold font-heading text-amber-500">+{coinsEarned}</div>
                <div className="text-xs text-slate-400 font-body">Coins</div>
              </div>
            )}
            {streakCount !== undefined && streakCount > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold font-heading text-orange-500">{streakCount}</div>
                <div className="text-xs text-slate-400 font-body">Streak</div>
              </div>
            )}
          </div>
        )}

        {phase >= 2 && newBadges && newBadges.length > 0 && (
          <div className="animate-fade-in">
            <p className="text-xs text-slate-400 font-body mb-2">New Badge!</p>
            <div className="flex justify-center gap-2">
              {newBadges.map((badge) => (
                <div
                  key={badge}
                  className="bg-amber-50 border-2 border-amber-200 rounded-xl px-3 py-2 text-sm font-heading font-bold text-amber-700 inline-flex items-center gap-1.5"
                >
                  <Award className="w-4 h-4" strokeWidth={2.5} aria-hidden /> {badge}
                </div>
              ))}
            </div>
          </div>
        )}

        {phase >= 3 && (
          <button
            onClick={onComplete}
            className="w-full py-3 rounded-2xl font-heading font-bold text-white text-base transition-all hover:scale-105 active:scale-95 animate-fade-in"
            style={{ backgroundColor: accentColor }}
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
