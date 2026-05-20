/**
 * Sprint 14: Quest hub redesign — calm motivation, not noisy gamification.
 *
 * Sprint 14 spec: motivation without loot boxes, confetti, or
 * gambling mechanics. Each world becomes a soft card with a calm
 * mastery dot strip and a single "next chapter" CTA.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
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

  const worlds = listQuestWorlds();
  const progress = listQuestProgressForLearner(learnerId, session.tenantId);
  const completedChapterIds = new Set(
    progress.filter((p) => p.progress >= 1).map((p) => p.chapterId),
  );

  const totalChapters = worlds.reduce((acc, w) => acc + listQuestChapters(w.id).length, 0);
  const completedCount = completedChapterIds.size;

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <AICompanionHero
        eyebrow="Quests · curriculum-aligned, never points-for-points"
        title="Pick a quest"
        body="Every chapter is a real lesson AIVO picked for you. No badges to collect — just one calm step at a time, with a tutor by your side."
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
          <EmptyState
            title="No quests yet"
            body="Quests will appear here once your learning path is ready. Check back soon!"
          />
        </div>
      ) : (
        <>
          <section className="mt-6 rounded-iw-card-lg bg-white border border-iw-border p-5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <p className="iw-label text-iw-text-muted">Across all quests</p>
              <p className="text-lg font-semibold text-iw-text-strong">
                {completedCount} chapter{completedCount === 1 ? "" : "s"} complete{" "}
                <span className="text-iw-text-muted">of {totalChapters}</span>
              </p>
            </div>
            <BaselineProgressDots
              states={Array.from({ length: totalChapters }, (_, i): DotState =>
                i < completedCount ? "answered" : "pending",
              )}
              ariaLabel="Total quest progress"
            />
          </section>

          <section className="mt-6 grid gap-4 md:grid-cols-2" aria-label="Quest worlds">
            {worlds.map((w) => {
              const chapters = listQuestChapters(w.id);
              const normal = chapters.filter((c) => !c.isBoss);
              const boss = chapters.find((c) => c.isBoss);
              const done = normal.filter((c) => completedChapterIds.has(c.id)).length;
              const bossDone = boss ? completedChapterIds.has(boss.id) : false;
              const states: DotState[] = normal.map((c) =>
                completedChapterIds.has(c.id) ? "answered" : "pending",
              );
              return (
                <GlassCard
                  key={w.id}
                  elevation="raised"
                  density="comfortable"
                >
                  <header className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-iw-text-strong leading-snug">
                        {w.name}
                      </h2>
                      <p className="text-sm text-iw-text-muted mt-1">{w.description}</p>
                    </div>
                    <InsightChip
                      tone={bossDone ? "success" : "primary"}
                      size="md"
                    >
                      {done}/{normal.length}
                    </InsightChip>
                  </header>
                  <BaselineProgressDots states={states} ariaLabel={`${w.name} progress`} />
                  {boss ? (
                    <p className="mt-3 text-xs text-iw-text-muted">
                      {bossDone
                        ? "Boss chapter complete"
                        : `Boss chapter unlocks after ${boss.prerequisiteChapterIds.length} chapter${
                            boss.prerequisiteChapterIds.length === 1 ? "" : "s"
                          }`}
                    </p>
                  ) : null}
                  <Link
                    href={`/learner/quests/${w.id}`}
                    className="mt-4 inline-flex items-center gap-2 self-start rounded-iw-control px-4 py-2 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
                  >
                    {done > 0 ? "Continue" : "Start quest"}
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14" />
                      <path d="m13 5 7 7-7 7" />
                    </svg>
                  </Link>
                </GlassCard>
              );
            })}
          </section>
        </>
      )}
    </AppShell>
  );
}
