"use client";
import { ShoppingBag, Award, Trophy, Flame, Gem, Star, Medal } from "lucide-react";
import { useFlVariant, LearnerCard } from "@aivo/learner-ui";
import { useTranslations } from "next-intl";

interface Badge {
  id: string;
  name: string;
  rarity: string;
}

interface RewardsTabProps {
  badges: Badge[];
  streakCurrent: number;
  streakLongest: number;
  coins: number;
  gems: number;
  onNavigate: (path: string) => void;
}

function rarityIcon(rarity: string) {
  if (rarity === "legendary") return <Gem className="w-7 h-7 text-[hsl(var(--visual-primary))]" strokeWidth={2.5} />;
  if (rarity === "epic") return <Star className="w-7 h-7 text-[hsl(var(--visual-math))] fill-[hsl(var(--visual-math))]" strokeWidth={2.5} />;
  if (rarity === "rare") return <Star className="w-7 h-7 text-[hsl(var(--visual-reading))] fill-[hsl(var(--visual-reading))]" strokeWidth={2.5} />;
  return <Medal className="w-7 h-7 text-[hsl(var(--visual-sel))]" strokeWidth={2.5} />;
}

export function RewardsTab({ badges, streakCurrent, streakLongest, onNavigate }: RewardsTabProps) {
  const { isLow } = useFlVariant();
  const t = useTranslations("learner");

  const chip = (key: "shop" | "badges" | "leaderboard") => {
    const map = {
      shop: { color: "hsl(var(--visual-science))", tint: "hsl(var(--visual-science) / 0.12)", label: t("shop"), path: "/dashboard/learner/shop", Icon: ShoppingBag },
      badges: { color: "hsl(var(--visual-sel))", tint: "hsl(var(--visual-sel) / 0.16)", label: t("rewards_badges"), path: "/dashboard/learner/badges", Icon: Award },
      leaderboard: { color: "hsl(var(--visual-primary))", tint: "hsl(var(--visual-primary) / 0.12)", label: t("leaderboard"), path: "/dashboard/learner/leaderboard", Icon: Trophy },
    } as const;
    const { color, tint, label, path, Icon } = map[key];
    return (
      <button
        onClick={() => onNavigate(path)}
        className={`inline-flex items-center gap-2 rounded-full font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2 ${
          isLow ? "px-7 py-4 text-lg" : "px-5 py-2.5 text-sm"
        }`}
        style={{ backgroundColor: tint, color, ["--tw-ring-color" as string]: color, minHeight: "var(--learner-hit-target, 40px)" } as React.CSSProperties}
      >
        <Icon className="w-4 h-4" strokeWidth={2.5} aria-hidden /> {label}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-center gap-3">
        {chip("shop")}
        {chip("badges")}
        {!isLow && chip("leaderboard")}
      </div>

      {badges.length > 0 && (
        <LearnerCard>
          <h3 className="font-extrabold text-slate-900 mb-3">{t("recent_badges")}</h3>
          <div className={`grid gap-3 ${isLow ? "grid-cols-2" : "grid-cols-3 md:grid-cols-4"}`}>
            {badges.slice(0, isLow ? 4 : 8).map((b) => (
              <div key={b.id} className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-100">
                <div className="mb-1 flex justify-center" aria-hidden>{rarityIcon(b.rarity)}</div>
                <div className="text-xs font-extrabold text-slate-700 truncate">{b.name}</div>
              </div>
            ))}
          </div>
        </LearnerCard>
      )}

      <LearnerCard>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))]">
              <Flame className="w-5 h-5" strokeWidth={2.5} aria-hidden />
            </div>
            <span className="font-extrabold text-slate-900">{t("streak_days_label", { count: streakCurrent })}</span>
          </div>
          <span className="text-sm text-slate-500 font-semibold">{t("streak_best_label", { count: streakLongest })}</span>
        </div>
      </LearnerCard>
    </div>
  );
}
