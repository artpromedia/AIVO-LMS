import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import { listQuestChapters, listQuestProgressForLearner, listQuestWorlds } from "@/lib/db/repos";

export default async function Page() {
  const session = await requirePageRole(["learner"]);
  const learnerId = session.learnerId;
  if (!learnerId) {
    return (
      <AppShell
        role="learner"
        roleLabel="Learner"
        navItems={LEARNER_NAV}
        user={{ displayName: session.displayName, email: session.email }}
      >
        <EmptyState title="No learner profile linked" />
      </AppShell>
    );
  }
  const worlds = listQuestWorlds();
  const progress = listQuestProgressForLearner(learnerId, session.tenantId);
  const completedByChapter = new Map(progress.map((p) => [p.chapterId, p.progress >= 1]));

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Learner"
        title="Rewards"
        description="Track every chapter you've completed across the quest worlds."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {worlds.map((w) => {
          const chapters = listQuestChapters(w.id);
          const done = chapters.filter((c) => completedByChapter.get(c.id)).length;
          return (
            <Card key={w.id} className="p-[var(--aivo-density-card-pad)]">
              <div className="flex items-center justify-between">
                <p className="font-display text-lg font-semibold">{w.name}</p>
                <Badge tone={done === chapters.length ? "success" : "primary"}>
                  {done}/{chapters.length}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-aivo-ink-soft">{w.description}</p>
              <Link
                href={`/learner/quests/${w.id}`}
                className="mt-3 inline-block text-xs font-medium text-aivo-primary hover:underline"
              >
                Open world →
              </Link>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
