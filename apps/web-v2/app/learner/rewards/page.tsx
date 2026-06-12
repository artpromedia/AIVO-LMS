import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import {
  listQuestChapters,
  listQuestProgressForLearner,
  listQuestWorlds,
  getLearnerEngagement,
  listLearnerBadges,
} from "@/lib/db/repos";
import { StickerBook } from "@/components/playful-calm";
import { AivoMascot } from "@/components/learner/art/aivo-mascot";
import { BadgeCollection, ALL_BADGES } from "@/components/learner/badge-collection";
import { WorkspaceThemePicker } from "@/components/learner/workspace-theme-picker";
import { TutorFace } from "@/components/learner/art/tutor-character";
import { tutorKeyForWorldSlug } from "@/lib/learner/quest-worlds";
import { XP_PER_LEVEL } from "@/lib/learner/engagement-award";
import { readWorkspaceThemeFromCookies } from "@/lib/a11y/server";
import type { BadgeKey } from "@/lib/db/types";

export default async function Page() {
  const session = await requirePageRole(["learner"]);
  const t = await getTranslations("learner.rewards");
  const tc = await getTranslations("learner.common");
  const learnerId = session.learnerId;
  if (!learnerId) {
    return (
      <AppShell
        role="learner"
        roleLabel="Learner"
        navItems={LEARNER_NAV}
        user={{ displayName: session.displayName, email: session.email }}
      >
        <EmptyState title={tc("no_profile")} />
      </AppShell>
    );
  }
  const th = await getTranslations("learner.home");
  const worlds = await listQuestWorlds();
  const progress = await listQuestProgressForLearner(learnerId, session.tenantId);
  const completedByChapter = new Map(progress.map((p) => [p.chapterId, p.progress >= 1]));

  // Progression you can feel — real engagement + badges.
  const engagement = await getLearnerEngagement(learnerId, session.tenantId);
  const level = engagement?.level ?? 1;
  const xp = engagement?.totalXp ?? 0;
  const streakDays = engagement?.currentStreakDays ?? 0;
  const xpInLevel = xp % XP_PER_LEVEL;
  const xpPct = Math.round((xpInLevel / XP_PER_LEVEL) * 100);
  const badges = await listLearnerBadges(learnerId, session.tenantId);
  const earnedKeys = new Set<BadgeKey>(badges.map((b) => b.badgeKey));
  const workspaceTheme = await readWorkspaceThemeFromCookies();

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={tc("learner_eyebrow")}
        title={t("title")}
        description={t("description")}
      />

      {/* Level journey — Aivo celebrates the learner's progress */}
      <section className="mb-4 flex items-center gap-4 rounded-3xl border border-iw-border/60 bg-white p-5">
        <AivoMascot expression={badges.length > 0 ? "celebrating" : "greeting"} size={72} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-bold text-iw-text-strong">
              <span
                className="grid h-8 w-8 place-items-center rounded-full text-sm font-bold text-white"
                style={{ background: "var(--color-aivo-primary)" }}
                aria-hidden="true"
              >
                {level}
              </span>
              {th("stat_level", { level })}
            </span>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: "var(--lx-warm-ink)" }}
            >
              {th("xp_progress", { xp: xpInLevel, goal: XP_PER_LEVEL })}
            </span>
          </div>
          <div
            className="lx-xpbar"
            role="progressbar"
            aria-valuenow={xpInLevel}
            aria-valuemin={0}
            aria-valuemax={XP_PER_LEVEL}
            aria-label={`${th("stat_level", { level })}, ${th("xp_progress", {
              xp: xpInLevel,
              goal: XP_PER_LEVEL,
            })}`}
          >
            <div className="lx-xpbar__fill" style={{ ["--lx-xp-pct" as string]: `${xpPct}%` }} />
          </div>
          <span className="text-sm text-iw-text-muted">
            {th("streak_label")} · {th("streak_value", { days: streakDays })}
          </span>
        </div>
      </section>

      {/* Badge collection */}
      <section className="mb-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-iw-text-strong">{t("badges_title")}</h2>
          <span className="text-sm font-semibold text-iw-text-muted">
            {t("badges_count", { earned: badges.length, total: ALL_BADGES.length })}
          </span>
        </div>
        <BadgeCollection
          earnedKeys={earnedKeys}
          earnedLabel={t("badge_earned")}
          howtoLabel={t("badge_howto")}
        />
      </section>

      {/* Unlockable workspace themes — progress buys personalization */}
      <WorkspaceThemePicker learnerLevel={level} initialTheme={workspaceTheme} />

      <div className="mb-4">
        <StickerBook
          emptyEncouragement={t("sticker_empty_encouragement")}
          earned={progress.filter((p) => p.progress >= 1).length}
          total={Math.max(progress.length, 1)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {await Promise.all(
          worlds.map(async (w) => {
            const chapters = await listQuestChapters(w.id);
            const done = chapters.filter((c) => completedByChapter.get(c.id)).length;
            const worldTutor = tutorKeyForWorldSlug(w.slug);
            return (
              <Card key={w.id} className="p-[var(--aivo-density-card-pad)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {worldTutor ? <TutorFace tutorKey={worldTutor} size={44} /> : null}
                    <p className="font-display text-lg font-semibold">{w.name}</p>
                  </div>
                  <Badge tone={done === chapters.length ? "success" : "primary"}>
                    {done}/{chapters.length}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-aivo-ink-soft">{w.description}</p>
                <Link
                  href={`/learner/quests/${w.id}`}
                  className="mt-3 inline-block text-xs font-medium text-aivo-primary hover:underline"
                >
                  {t("open_world")}
                </Link>
              </Card>
            );
          }),
        )}
      </div>
    </AppShell>
  );
}
