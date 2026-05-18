"use client";
import { useAuth } from "@/providers/auth-provider";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Flame,
  Star,
  Sprout,
  Trophy,
  Target,
  TrendingUp,
  Brain,
  ClipboardList,
  Sparkles,
  BookOpen,
  Award,
  Users,
  Rainbow,
  Zap,
  Globe2,
  HelpCircle,
} from "lucide-react";
import { IconWell } from "@/components/discovery/_vi";
import type { ReactNode } from "react";

interface Milestone {
  id: string;
  type: string;
  title: string;
  description?: string;
  createdAt: string;
}

interface Badge {
  id: string;
  badgeKey: string;
  earnedAt: string;
}

const BADGE_DEFINITIONS: Record<string, { name: string; icon: ReactNode; description: string }> = {
  first_session: {
    name: "First Session",
    icon: <Star className="w-7 h-7" />,
    description: "Complete first tutoring session",
  },
  on_fire: { name: "On Fire", icon: <Flame className="w-7 h-7" />, description: "7-day streak" },
  brain_activated: {
    name: "Brain Activated",
    icon: <Brain className="w-7 h-7" />,
    description: "Brain profile approved",
  },
  bookworm: {
    name: "Bookworm",
    icon: <BookOpen className="w-7 h-7" />,
    description: "10 sessions completed",
  },
  mastery_champion: {
    name: "Mastery Champion",
    icon: <Trophy className="w-7 h-7" />,
    description: "Any subject above 75%",
  },
  goal_getter: {
    name: "Goal Getter",
    icon: <Target className="w-7 h-7" />,
    description: "IEP goal met",
  },
  team_player: {
    name: "Team Player",
    icon: <Users className="w-7 h-7" />,
    description: "Full learning team",
  },
  multi_subject: {
    name: "Multi-Subject",
    icon: <Rainbow className="w-7 h-7" />,
    description: "Active in 3+ subjects",
  },
  speed_learner: {
    name: "Speed Learner",
    icon: <Zap className="w-7 h-7" />,
    description: "Top 25% session time",
  },
  explorer: {
    name: "Explorer",
    icon: <Globe2 className="w-7 h-7" />,
    description: "All subject areas explored",
  },
};

const TYPE_ICONS: Record<string, ReactNode> = {
  skill_mastered: <Target className="w-5 h-5" />,
  streak: <Flame className="w-5 h-5" />,
  xp_milestone: <Star className="w-5 h-5" />,
  badge_earned: <Trophy className="w-5 h-5" />,
  mastery_up: <TrendingUp className="w-5 h-5" />,
  brain_created: <Brain className="w-5 h-5" />,
  joined: <ClipboardList className="w-5 h-5" />,
};

export default function MilestonesPage() {
  const { user, accessToken, loading } = useAuth();
  const params = useParams();
  const learnerId = params.id as string;
  const t = useTranslations("parent");

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [streak, setStreak] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    fetch(`/api/family/milestones/${learnerId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : { milestones: [], badges: [], streak: null }))
      .then((data) => {
        setMilestones(data.milestones || []);
        setBadges(data.badges || []);
        setStreak(data.streak);
      })
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, [accessToken, learnerId]);

  if (loading || !user) return null;

  const earnedKeys = new Set(badges.map((b) => b.badgeKey));
  const allBadges = Object.entries(BADGE_DEFINITIONS);

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold vi-text">Milestones & Badges</h1>

      {streak && (
        <div className="flex gap-4">
          <div className="vi-card p-4 flex-1 text-center bg-[hsl(var(--visual-sel)/0.12)]">
            <div className="flex justify-center mb-1">
              <Flame className="w-7 h-7 text-[hsl(var(--visual-sel))]" />
            </div>
            <div className="text-2xl font-bold text-[hsl(var(--visual-sel))]">
              {streak.currentStreak}
            </div>
            <div className="text-xs text-[hsl(var(--visual-sel))] font-semibold">
              Current Streak
            </div>
          </div>
          <div className="vi-card p-4 flex-1 text-center bg-[hsl(var(--visual-sel)/0.08)]">
            <div className="flex justify-center mb-1">
              <Star className="w-7 h-7 text-[hsl(var(--visual-sel))]" />
            </div>
            <div className="text-2xl font-bold text-[hsl(var(--visual-sel))]">
              {streak.longestStreak}
            </div>
            <div className="text-xs text-[hsl(var(--visual-sel))] font-semibold">
              Longest Streak
            </div>
          </div>
        </div>
      )}

      <div className="vi-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <IconWell color="sel" size="sm">
            <Award className="w-5 h-5" />
          </IconWell>
          <h2 className="text-lg font-heading font-bold vi-text">Badge Collection</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {allBadges.map(([key, def]) => {
            const earned = earnedKeys.has(key);
            return (
              <div
                key={key}
                className={`text-center p-3 rounded-xl border ${earned ? "bg-[hsl(var(--visual-primary)/0.08)] border-[hsl(var(--visual-primary)/0.3)]" : "vi-surface-soft vi-border opacity-60"}`}
              >
                <div
                  className={`flex justify-center mb-1 ${earned ? "text-[hsl(var(--visual-primary))]" : "vi-text-muted"}`}
                >
                  {earned ? def.icon : <HelpCircle className="w-7 h-7" />}
                </div>
                <div
                  className={`text-xs font-bold ${earned ? "text-[hsl(var(--visual-primary))]" : "vi-text-muted"}`}
                >
                  {def.name}
                </div>
                <div className="text-[10px] vi-text-muted mt-0.5">{def.description}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="vi-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <IconWell color="primary" size="sm">
            <Sparkles className="w-5 h-5" />
          </IconWell>
          <h2 className="text-lg font-heading font-bold vi-text">Achievement Timeline</h2>
        </div>
        {loadingData ? (
          <div className="text-center py-8 vi-text-muted animate-pulse">Loading...</div>
        ) : milestones.length === 0 ? (
          <div className="text-center py-8">
            <div className="flex justify-center mb-2">
              <IconWell color="science" size="sm">
                <Sprout className="w-5 h-5" />
              </IconWell>
            </div>
            <p className="vi-text-muted font-semibold">
              Achievements will appear here as your child progresses!
            </p>
          </div>
        ) : (
          <div className="space-y-4 relative">
            <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-[hsl(var(--visual-primary)/0.2)]" />
            {milestones.map((m) => (
              <div key={m.id} className="flex items-start gap-3 relative">
                <div className="w-10 h-10 rounded-full bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] flex items-center justify-center flex-shrink-0 z-10 border-2 border-white">
                  {TYPE_ICONS[m.type] || <Trophy className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 justify-between">
                    <p className="text-sm font-bold text-slate-800">{m.title}</p>
                    <span className="text-xs vi-text-muted flex-shrink-0">
                      {formatDate(m.createdAt)}
                    </span>
                  </div>
                  {m.description && <p className="text-xs vi-text-muted mt-0.5">{m.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
