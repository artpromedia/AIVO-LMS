/**
 * Sprint 16: Quest chapter "start" entry. This is a thin server page that
 * kicks off (or resumes) the chapter's LessonRun via `startQuestChapter`
 * and redirects to the lesson player. Lock errors render a recovery card
 * rather than failing silently — there is no dead "Complete Activity"
 * button anywhere; the only completion path is the real lesson player.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { readActiveLearnerFromCookies } from "@/lib/auth/active-learner";
import { AppShell } from "@/components/layout/app-shell";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getQuestWorld, startQuestChapter } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ worldId: string; chapterId: string }> };

export default async function QuestChapterStartPage({ params }: Params) {
  const { worldId, chapterId } = await params;
  const session = await requirePageRole(["learner", "parent"]);
  let learnerId: string | null = null;
  if (session.role === "learner") {
    learnerId = session.learnerId ?? null;
    if (!learnerId) redirect("/learner/select");
  } else {
    learnerId = await readActiveLearnerFromCookies(session);
    if (!learnerId) redirect("/learner/select");
  }
  const world = getQuestWorld(worldId);
  if (!world) notFound();

  const result = await startQuestChapter({
    learnerId,
    tenantId: session.tenantId,
    worldId,
    chapterId,
  });
  if (result.ok) {
    redirect(`/learner/lesson-runs/${result.lessonRunId}`);
  }

  // Locked / not-found / failed — show a recovery panel with a retry path.
  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Quest"
        title={world.name}
        description="We couldn't start this chapter yet."
      />
      <Card className="p-[var(--aivo-density-card-pad)]">
        <p className="text-sm" role="alert">
          {result.message}
        </p>
        <div className="mt-4 flex gap-2">
          <Button asChild variant="soft">
            <Link href={`/learner/quests/${worldId}`}>Back to chapter map</Link>
          </Button>
          <Button asChild>
            <Link href="/learner/quests">All quests</Link>
          </Button>
        </div>
      </Card>
    </AppShell>
  );
}
