"use client";
import {
  Target,
  Flame,
  Star,
  Trophy,
  BookOpen,
  TrendingUp,
  Users,
  Megaphone,
  Newspaper,
  type LucideIcon,
} from "lucide-react";

interface Activity {
  id: string;
  type: string;
  title: string;
  description?: string;
  learnerName?: string;
  createdAt: string;
}

interface WhileYouWereAwayProps {
  activities: Activity[];
  lastVisit: string | null;
}

const TYPE_VISUAL: Record<string, { Icon: LucideIcon; color: string; bg: string }> = {
  skill_mastered: {
    Icon: Target,
    color: "text-[hsl(var(--visual-science))]",
    bg: "bg-[hsl(var(--visual-science)/0.12)]",
  },
  streak: {
    Icon: Flame,
    color: "text-[hsl(var(--visual-sel))]",
    bg: "bg-[hsl(var(--visual-sel)/0.12)]",
  },
  xp_milestone: {
    Icon: Star,
    color: "text-[hsl(var(--visual-sel))]",
    bg: "bg-[hsl(var(--visual-sel)/0.12)]",
  },
  badge_earned: {
    Icon: Trophy,
    color: "text-[hsl(var(--visual-sel))]",
    bg: "bg-[hsl(var(--visual-sel)/0.12)]",
  },
  session_completed: {
    Icon: BookOpen,
    color: "text-[hsl(var(--visual-reading))]",
    bg: "bg-[hsl(var(--visual-reading)/0.12)]",
  },
  mastery_up: {
    Icon: TrendingUp,
    color: "text-[hsl(var(--visual-math))]",
    bg: "bg-[hsl(var(--visual-math)/0.12)]",
  },
  team_change: {
    Icon: Users,
    color: "text-[hsl(var(--visual-primary))]",
    bg: "bg-[hsl(var(--visual-primary)/0.12)]",
  },
  default: {
    Icon: Megaphone,
    color: "vi-text-muted",
    bg: "vi-surface-soft",
  },
};

export function WhileYouWereAway({ activities, lastVisit }: WhileYouWereAwayProps) {
  if (!lastVisit || activities.length === 0) return null;

  const daysSince = Math.floor(
    (Date.now() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysSince < 1) return null;

  return (
    <div className="vi-card p-5 lg:p-6">
      <h2 className="text-lg font-heading font-bold vi-text mb-4 flex items-center gap-2">
        <span className="w-9 h-9 rounded-xl bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] flex items-center justify-center shrink-0">
          <Newspaper size={18} strokeWidth={2.5} aria-hidden="true" />
        </span>
        While you were away
        <span className="ml-auto text-xs font-bold vi-text-muted px-2.5 py-1 rounded-full vi-surface-soft">
          {daysSince} day{daysSince !== 1 ? "s" : ""}
        </span>
      </h2>
      <ul className="space-y-3">
        {activities.slice(0, 5).map((a) => {
          const v = TYPE_VISUAL[a.type] || TYPE_VISUAL.default;
          return (
            <li key={a.id} className="flex items-start gap-3">
              <span
                className={`w-10 h-10 rounded-2xl ${v.bg} ${v.color} flex items-center justify-center shrink-0`}
                aria-hidden="true"
              >
                <v.Icon size={18} strokeWidth={2.5} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm vi-text leading-snug">
                  {a.learnerName && <span className="font-bold vi-text">{a.learnerName}: </span>}
                  <span className="font-medium">{a.title}</span>
                </p>
                {a.description && (
                  <p className="text-xs vi-text-muted mt-0.5 font-medium">{a.description}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
