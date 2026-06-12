/**
 * Sprint 14: Quest hub redesign — calm motivation, not noisy gamification.
 *
 * Sprint 14 spec: motivation without loot boxes, confetti, or
 * gambling mechanics. Each world becomes a soft card with a calm
 * mastery dot strip and a single "next chapter" CTA.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { readActiveLearnerFromCookies } from "@/lib/auth/active-learner";
import { AppShell } from "@/components/layout/app-shell";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import {
  AICompanionHero,
  PersonalizationChip,
  GlassCard,
  InsightChip,
  EmptyState,
  BaselineProgressDots,
  type DotState,
} from "@aivo/ui";
import { listQuestChapters, listQuestProgressForLearner, listQuestWorlds } from "@/lib/db/repos";
import { tutorKeyForWorldSlug } from "@/lib/learner/quest-worlds";
import { TutorFace } from "@/components/learner/art/tutor-character";
import { tutorThemeCSSVars } from "@aivo/brand";
import type { CSSProperties } from "react";

export const dynamic = "force-dynamic";

export default async function LearnerQuestsPage() {
  const session = await requirePageRole(["learner", "parent"]);
  let learnerId: string | null = null;
  if (session.role === "learner") {
    learnerId = session.learnerId ?? null;
    if (!learnerId) redirect("/learner/select");
  } else {
    learnerId = await readActiveLearnerFromCookies(session);
    if (!learnerId) redirect("/learner/select");
  }

  const worlds = await listQuestWorlds();
  const progress = await listQuestProgressForLearner(learnerId, session.tenantId);
  const completedChapterIds = new Set(
    progress.filter((p) => p.progress >= 1).map((p) => p.chapterId),
  );

  const chaptersByWorld = await Promise.all(worlds.map((w) => listQuestChapters(w.id)));
  const totalChapters = chaptersByWorld.reduce((acc, list) => acc + list.length, 0);
  const completedCount = completedChapterIds.size;
  const t = await getTranslations("learner.quests");

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <AICompanionHero
        eyebrow={t("hero_eyebrow")}
        title={t("hero_title")}
        body={t("hero_body")}
        chips={
          <>
            <PersonalizationChip variant="no_grades" />
            <PersonalizationChip variant="ai_companion" />
            <PersonalizationChip variant="pacing" />
          </>
        }
      />

      {worlds.length === 0 ? (
        <div className="mt-6 rounded-iw-card-lg bg-white border border-iw-border p-6">
          <EmptyState title={t("no_quests_title")} body={t("no_quests_body")} />
        </div>
      ) : (
        <>
          <section className="mt-6 rounded-iw-card-lg bg-white border border-iw-border p-5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <p className="iw-label text-iw-text-muted">{t("across_all")}</p>
              <p className="text-lg font-semibold text-iw-text-strong">
                {t("chapters_complete", { count: completedCount })}{" "}
                <span className="text-iw-text-muted">
                  {t("of_total", { total: totalChapters })}
                </span>
              </p>
            </div>
            <BaselineProgressDots
              states={Array.from(
                { length: totalChapters },
                (_, i): DotState => (i < completedCount ? "answered" : "pending"),
              )}
              ariaLabel={t("total_progress_aria")}
            />
          </section>

          <section className="mt-6 grid gap-4 md:grid-cols-2" aria-label={t("worlds_aria")}>
            {await Promise.all(
              worlds.map(async (w) => {
                const chapters = await listQuestChapters(w.id);
                const normal = chapters.filter((c) => !c.isBoss);
                const boss = chapters.find((c) => c.isBoss);
                const done = normal.filter((c) => completedChapterIds.has(c.id)).length;
                const bossDone = boss ? completedChapterIds.has(boss.id) : false;
                const states: DotState[] = normal.map((c) =>
                  completedChapterIds.has(c.id) ? "answered" : "pending",
                );
                const tutorKey = tutorKeyForWorldSlug(w.slug);
                const worldVars = (tutorKey ? tutorThemeCSSVars(tutorKey) : {}) as CSSProperties;
                return (
                  <div key={w.id} data-tutor={tutorKey ?? undefined} style={worldVars}>
                    <GlassCard elevation="raised" density="comfortable">
                      <header className="flex items-start gap-3 mb-3">
                        {tutorKey ? <TutorFace tutorKey={tutorKey} size={48} /> : null}
                        <div className="min-w-0 flex-1">
                          <h2 className="text-lg font-semibold text-iw-text-strong leading-snug">
                            {w.name}
                          </h2>
                          <p className="text-sm text-iw-text-muted mt-1">{w.description}</p>
                        </div>
                        <InsightChip tone={bossDone ? "success" : "primary"} size="md">
                          {done}/{normal.length}
                        </InsightChip>
                      </header>
                      <BaselineProgressDots
                        states={states}
                        ariaLabel={t("world_progress_aria", { name: w.name })}
                      />
                      {boss ? (
                        <p className="mt-3 text-xs text-iw-text-muted">
                          {bossDone
                            ? t("boss_complete")
                            : t("boss_unlocks", { count: boss.prerequisiteChapterIds.length })}
                        </p>
                      ) : null}
                      <Link
                        href={`/learner/quests/${w.id}`}
                        style={{
                          backgroundColor: "var(--tutor-accent, var(--aivo-sensory-primary))",
                        }}
                        className="mt-4 inline-flex items-center gap-2 self-start rounded-iw-control px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
                      >
                        {done > 0 ? t("continue") : t("start_quest")}
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.25"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M5 12h14" />
                          <path d="m13 5 7 7-7 7" />
                        </svg>
                      </Link>
                    </GlassCard>
                  </div>
                );
              }),
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
