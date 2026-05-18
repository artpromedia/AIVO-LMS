/**
 * Sprint 16: Quest world list. Server-rendered using the same repo helpers
 * the BFF uses so we share the unlock/completion math. Each world card links
 * to its chapter map.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { readActiveLearnerFromCookies } from "@/lib/auth/active-learner";
import { AppShell } from "@/components/layout/app-shell";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Quests"
        title="Pick a quest"
        description="Every chapter is a real personalized lesson. Finish all the chapters to unlock the boss."
      />
      {worlds.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No quests are available yet. Check back soon!
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2" aria-label="Quest worlds">
          {worlds.map((w) => {
            const chapters = listQuestChapters(w.id);
            const normal = chapters.filter((c) => !c.isBoss);
            const boss = chapters.find((c) => c.isBoss);
            const done = normal.filter((c) => completedChapterIds.has(c.id)).length;
            const bossDone = boss ? completedChapterIds.has(boss.id) : false;
            return (
              <li key={w.id}>
                <Link
                  href={`/learner/quests/${w.id}`}
                  className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                >
                  <Card className="p-[var(--aivo-density-card-pad)] hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">{w.name}</h2>
                        <p className="text-sm text-muted-foreground mt-1">{w.description}</p>
                      </div>
                      <Badge tone={bossDone ? "success" : "primary"}>
                        {done}/{normal.length}
                      </Badge>
                    </div>
                    {boss ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {bossDone
                          ? "Boss defeated"
                          : `Boss unlocks after ${boss.prerequisiteChapterIds.length} chapter${boss.prerequisiteChapterIds.length === 1 ? "" : "s"}`}
                      </p>
                    ) : null}
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
