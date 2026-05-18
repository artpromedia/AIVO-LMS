"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Footprints,
  BookOpen,
  Wand2,
  Flame,
  FlaskConical,
  HandHeart,
  Brain,
  Star,
  Trophy,
  Shield,
  type LucideIcon,
} from "lucide-react";

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: string;
  earnedAt?: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

const RARITY_COLORS = {
  common: "from-slate-100 to-slate-200 border-slate-300 text-slate-700",
  rare: "from-blue-100 to-blue-200 border-blue-300 text-blue-700",
  epic: "from-purple-100 to-purple-200 border-purple-300 text-purple-700",
  legendary: "from-amber-100 to-amber-200 border-amber-400 text-amber-700",
};

const RARITY_GLOW = {
  common: "",
  rare: "shadow-blue-200/50",
  epic: "shadow-purple-200/50",
  legendary: "shadow-amber-200/50 ring-2 ring-amber-300/30",
};

const SAMPLE_BADGES: Badge[] = [
  {
    id: "1",
    name: "First Steps",
    description: "Complete your first lesson",
    icon: Footprints,
    category: "milestone",
    earnedAt: "2025-01-15",
    rarity: "common",
  },
  {
    id: "2",
    name: "Bookworm",
    description: "Read 10 lessons in ELA",
    icon: BookOpen,
    category: "subject",
    earnedAt: "2025-02-01",
    rarity: "common",
  },
  {
    id: "3",
    name: "Math Wizard",
    description: "Score 100% on 5 math quizzes",
    icon: Wand2,
    category: "subject",
    earnedAt: "2025-02-20",
    rarity: "rare",
  },
  {
    id: "4",
    name: "Streak Master",
    description: "Maintain a 7-day streak",
    icon: Flame,
    category: "engagement",
    earnedAt: "2025-03-05",
    rarity: "rare",
  },
  {
    id: "5",
    name: "Science Explorer",
    description: "Complete all Level 1 science lessons",
    icon: FlaskConical,
    category: "subject",
    earnedAt: "2025-03-15",
    rarity: "epic",
  },
  {
    id: "6",
    name: "Team Player",
    description: "Help 3 peers in challenges",
    icon: HandHeart,
    category: "social",
    rarity: "rare",
  },
  {
    id: "7",
    name: "Brain Builder",
    description: "Unlock all brain profile dimensions",
    icon: Brain,
    category: "milestone",
    rarity: "epic",
  },
  {
    id: "8",
    name: "Legend of AIVO",
    description: "Reach Level 50",
    icon: Star,
    category: "milestone",
    rarity: "legendary",
  },
  {
    id: "9",
    name: "Quest Champion",
    description: "Complete 10 quests",
    icon: Trophy,
    category: "engagement",
    earnedAt: "2025-04-01",
    rarity: "epic",
  },
  {
    id: "10",
    name: "Daily Hero",
    description: "Log in 30 days in a row",
    icon: Shield,
    category: "engagement",
    rarity: "legendary",
  },
];

export default function BadgesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const t = useTranslations("learner");
  const tGamification = useTranslations("gamification");
  const tCommon = useTranslations("common");
  const [filter, setFilter] = useState<"all" | "earned" | "locked">("all");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);
  if (loading || !user) return null;

  const earned = SAMPLE_BADGES.filter((b) => b.earnedAt);
  const locked = SAMPLE_BADGES.filter((b) => !b.earnedAt);
  const filtered = filter === "earned" ? earned : filter === "locked" ? locked : SAMPLE_BADGES;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-purple-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/dashboard/learner"
              className="text-sm text-primary hover:underline font-semibold mb-2 inline-block"
            >
              ← {tCommon("back")}
            </Link>
            <h1 className="text-3xl font-heading font-bold text-slate-900">{t("my_badges")}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {earned.length} {tCommon("of")} {SAMPLE_BADGES.length}
            </p>
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {(["all", "earned", "locked"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize ${filter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              >
                {f} (
                {f === "all"
                  ? SAMPLE_BADGES.length
                  : f === "earned"
                    ? earned.length
                    : locked.length}
                )
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((badge) => {
            const BadgeIcon = badge.icon;
            return (
              <div
                key={badge.id}
                className={`relative p-4 rounded-2xl border-2 text-center transition hover:scale-105 ${badge.earnedAt ? `bg-gradient-to-b ${RARITY_COLORS[badge.rarity]} shadow-lg ${RARITY_GLOW[badge.rarity]}` : "bg-slate-50 border-slate-200 opacity-50 grayscale"}`}
              >
                <div className="w-14 h-14 mx-auto mb-2 rounded-2xl bg-white/60 flex items-center justify-center">
                  <BadgeIcon className="w-7 h-7" strokeWidth={2} aria-hidden />
                </div>
                <p className="font-heading font-bold text-sm">{badge.name}</p>
                <p className="text-xs mt-1 opacity-70">{badge.description}</p>
                {badge.earnedAt && (
                  <p className="text-xs mt-2 opacity-50">
                    {new Date(badge.earnedAt).toLocaleDateString()}
                  </p>
                )}
                <span
                  className={`absolute top-2 right-2 text-xs font-bold uppercase px-1.5 py-0.5 rounded ${badge.rarity === "legendary" ? "bg-amber-500 text-white" : badge.rarity === "epic" ? "bg-purple-500 text-white" : badge.rarity === "rare" ? "bg-blue-500 text-white" : "bg-slate-400 text-white"}`}
                >
                  {badge.rarity}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
