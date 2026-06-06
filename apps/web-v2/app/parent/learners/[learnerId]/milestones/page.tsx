/**
 * Sprint 30: Parent · Milestones (gamification hub).
 * Surfaces the learner's XP, level, streaks, currency balance, and earned
 * badges. Mirrors the legacy `/dashboard/parent/learner/[id]/milestones` page
 * but reads from the v2 engagement + badges repos.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Flame,
  Star,
  Trophy,
  Target,
  Brain,
  BookOpen,
  Award,
  Users,
  Rainbow,
  Zap,
  Globe2,
  HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getLearner,
  getLearnerEngagement,
  listLearnerBadges,
  parentCanAccessLearner,
} from "@/lib/db/repos";
import type { BadgeKey } from "@/lib/db/types";

export const dynamic = "force-dynamic";

type BadgeDef = {
  name: string;
  description: string;
  icon: LucideIcon;
};

const BADGES: Record<BadgeKey, BadgeDef> = {
  first_session: {
    name: "First Session",
    description: "Complete the first tutoring session.",
    icon: Star,
  },
  on_fire: { name: "On Fire", description: "Maintain a 7-day learning streak.", icon: Flame },
  brain_activated: {
    name: "Brain Activated",
    description: "Brain profile reviewed and approved.",
    icon: Brain,
  },
  bookworm: { name: "Bookworm", description: "Ten sessions completed.", icon: BookOpen },
  mastery_champion: {
    name: "Mastery Champion",
    description: "Any subject above 75% mastery.",
    icon: Trophy,
  },
  goal_getter: { name: "Goal Getter", description: "IEP goal met for the period.", icon: Target },
  team_player: {
    name: "Team Player",
    description: "Full care team active and collaborating.",
    icon: Users,
  },
  multi_subject: {
    name: "Multi-Subject",
    description: "Active in three or more subjects.",
    icon: Rainbow,
  },
  speed_learner: {
    name: "Speed Learner",
    description: "Session time in top 25% of cohort.",
    icon: Zap,
  },
  explorer: { name: "Explorer", description: "Every subject area explored.", icon: Globe2 },
};

const ALL_KEYS = Object.keys(BADGES) as BadgeKey[];
const LEVEL_LABEL = "Level";

export default async function ParentMilestonesPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  const t = await getTranslations("parent.learner_milestones");
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  const eng = getLearnerEngagement(learnerId, session.tenantId);
  const earned = listLearnerBadges(learnerId, session.tenantId);
  const earnedKeys = new Set(earned.map((b) => b.badgeKey));

  const nextLevelXp = eng ? (eng.level + 1) * 250 : 250;
  const xpToNext = eng ? Math.max(0, nextLevelXp - eng.totalXp) : 250;
  const xpPct = eng ? Math.min(100, Math.round((eng.totalXp / nextLevelXp) * 100)) : 0;

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader eyebrow={learner.displayName} title={t("title")} description={t("description")} />

      {!eng ? (
        <EmptyState
          icon={<Award className="h-6 w-6" />}
          title={t("no_engagement_data")}
          description={t("no_engagement_desc")}
          action={
            <Link
              href={`/parent/learners/${learner.id}`}
              className="text-aivo-accent underline underline-offset-4"
            >
              {t("back_to_overview")}
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-[var(--aivo-density-card-pad)]">
              <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
                {t("total_xp")}
              </p>
              <p className="mt-1 font-display text-3xl font-semibold">
                {eng.totalXp.toLocaleString()}
              </p>
              <div className="mt-3 h-2 w-full rounded-full bg-aivo-border">
                <div className="h-2 rounded-full bg-aivo-accent" style={{ width: `${xpPct}%` }} />
              </div>
              <p className="mt-1 text-xs text-aivo-ink-soft">
                {xpToNext} XP to level {eng.level + 1}
              </p>
            </Card>
            <Card className="p-[var(--aivo-density-card-pad)]">
              <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
                {LEVEL_LABEL}
              </p>
              <p className="mt-1 font-display text-3xl font-semibold">{eng.level}</p>
              <p className="mt-3 text-xs text-aivo-ink-soft">{t("levels_desc")}</p>
            </Card>
            <Card className="p-[var(--aivo-density-card-pad)]">
              <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
                {t("current_streak")}
              </p>
              <p className="mt-1 flex items-center gap-2 font-display text-3xl font-semibold">
                <Flame className="h-7 w-7 text-orange-500" />
                {eng.currentStreakDays}d
              </p>
              <p className="mt-3 text-xs text-aivo-ink-soft">
                Longest streak: {eng.longestStreakDays} days
              </p>
            </Card>
            <Card className="p-[var(--aivo-density-card-pad)]">
              <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
                {t("wallet")}
              </p>
              <div className="mt-1 flex items-baseline gap-4">
                <span className="font-display text-2xl font-semibold">{eng.coins} ¢</span>
                <span className="font-display text-2xl font-semibold text-aivo-accent">
                  {eng.gems} ◆
                </span>
              </div>
              <p className="mt-3 text-xs text-aivo-ink-soft">{t("wallet_desc")}</p>
            </Card>
          </div>

          <SectionHeader title={t("badge_collection")} />
          <p className="-mt-3 mb-3 text-sm text-aivo-ink-soft">
            {earned.length} of {ALL_KEYS.length} earned.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_KEYS.map((key) => {
              const def = BADGES[key];
              const isEarned = earnedKeys.has(key);
              const Icon = def.icon;
              return (
                <Card key={key} className={`p-4 ${isEarned ? "" : "opacity-50"}`}>
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        isEarned
                          ? "bg-aivo-accent/20 text-aivo-accent"
                          : "bg-aivo-border/40 text-aivo-ink-soft"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{def.name}</p>
                        {isEarned ? (
                          <Badge tone="success">{t("earned")}</Badge>
                        ) : (
                          <Badge tone="neutral">{t("locked")}</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-aivo-ink-soft">{def.description}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <SectionHeader title={t("how_xp_works")} />
          <Card className="p-[var(--aivo-density-card-pad)]">
            <div className="flex items-start gap-3">
              <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-aivo-ink-soft" />
              <div className="space-y-1 text-sm text-aivo-ink-soft">
                <p>
                  Learners earn 10–40 XP per completed session, plus bonus XP for hitting their
                  daily quest goal and maintaining a streak.
                </p>
                <p>
                  Coins are converted from XP and can be spent in the Rewards Shop; Gems are
                  reserved for cosmetic upgrades and special items.
                </p>
                <p>
                  XP, levels, and badges have no effect on academic grades or IEP goal tracking —
                  they exist purely to keep learners engaged.
                </p>
              </div>
            </div>
          </Card>
        </>
      )}
    </AppShell>
  );
}
