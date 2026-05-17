"use client";
import { Star, Flame, Trophy, Heart } from "lucide-react";
import { useFlVariant } from "@aivo/learner-ui";
import { useTranslations } from "next-intl";

interface EngagementProfile {
  totalXp: number;
  level: number;
  xpForNextLevel: number;
  xpProgress: number;
  streak: { current: number; longest: number; tier: string };
  badges: { id: string; name: string; rarity: string }[];
  currency: { coins: number; gems: number };
  selMood?: string;
}

interface QuietProgressStripProps {
  profile: EngagementProfile | null;
}

const STREAK_COLORS: Record<string, string> = {
  grey: "hsl(var(--visual-text-muted))",
  orange: "hsl(var(--visual-sel))",
  purple: "hsl(var(--visual-primary))",
  gold: "hsl(var(--visual-sel))",
};

export function QuietProgressStrip({ profile }: QuietProgressStripProps) {
  const { profile: flProfile, isPreSymbolic } = useFlVariant();
  const t = useTranslations("learner");

  if (!profile || isPreSymbolic || flProfile.progressMode === "none" || flProfile.progressMode === "hidden") return null;

  const xpPercent = Math.min(100, (profile.xpProgress / profile.xpForNextLevel) * 100);
  const streakColor = STREAK_COLORS[profile.streak.tier] || STREAK_COLORS.grey;

  if (flProfile.progressMode === "stars-only") {
    return (
      <section className="px-4 md:px-8 py-4" aria-label={t("progress_label")}>
        <div className="flex items-center justify-center gap-6 vi-card p-4 max-w-xl mx-auto">
          <div className="flex items-center gap-2">
            <Star className="w-6 h-6 text-[hsl(var(--visual-sel))] fill-[hsl(var(--visual-sel))]" aria-hidden />
            <span className="text-xl font-extrabold text-[hsl(var(--visual-sel))]">{t("stars_count", { count: profile.totalXp })}</span>
          </div>
          <div className="flex items-center gap-2">
            <Flame className="w-6 h-6" style={{ color: streakColor }} aria-hidden />
            <span className="text-xl font-extrabold" style={{ color: streakColor }}>
              {t("progress_streak_days", { count: profile.streak.current })}
            </span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 md:px-8 py-4" aria-label={t("progress_label")}>
      <div className="flex items-center justify-center gap-4 md:gap-6 vi-card p-4 max-w-2xl mx-auto flex-wrap">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-[hsl(var(--visual-primary))] fill-[hsl(var(--visual-primary))]" aria-hidden />
          <span className="text-sm font-extrabold text-slate-900">{t("progress_level", { level: profile.level })}</span>
          <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="bg-[hsl(var(--visual-primary))] h-full rounded-full transition-all" style={{ width: `${xpPercent}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Flame className="w-5 h-5" style={{ color: streakColor }} aria-hidden />
          <span className="text-sm font-extrabold" style={{ color: streakColor }}>{t("progress_n_day_streak", { count: profile.streak.current })}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Trophy className="w-5 h-5 text-[hsl(var(--visual-sel))]" aria-hidden />
          <span className="text-sm font-extrabold text-slate-900">{t("progress_badges_count", { count: profile.badges.length })}</span>
        </div>
        {profile.selMood && (
          <div className="flex items-center gap-1.5">
            <Heart className="w-5 h-5 text-[hsl(var(--visual-math))] fill-[hsl(var(--visual-math))]" aria-hidden />
            <span className="text-sm font-extrabold text-slate-600">{t("progress_mood", { mood: profile.selMood })}</span>
          </div>
        )}
      </div>
    </section>
  );
}
