/**
 * Sprint 16: Quest world detail. Renders the chapter map with unlock and
 * completion state. Locked chapters render as non-interactive cards so a
 * learner cannot bypass prerequisites — boss unlock is enforced both in the
 * UI here and in `startQuestChapter` server-side.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { readActiveLearnerFromCookies } from "@/lib/auth/active-learner";
import { AppShell } from "@/components/layout/app-shell";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getQuestWorld,
  isQuestChapterUnlocked,
  listQuestChapters,
  listQuestProgressForLearner,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ worldId: string }> };

export default async function QuestWorldPage({ params }: Params) {
  const { worldId } = await params;
  const session = await requirePageRole(["learner", "parent"]);
  let learnerId: string | null = null;
  if (session.role === "learner") {
    learnerId = session.learnerId ?? null;
    if (!learnerId) redirect("/learner/select");
  } else {
    learnerId = await readActiveLearnerFromCookies(session);
    if (!learnerId) redirect("/learner/select");
  }
  const world = await getQuestWorld(worldId);
  if (!world) notFound();
  const chapters = await listQuestChapters(worldId);
  const progress = await listQuestProgressForLearner(learnerId, session.tenantId, worldId);
  const completed = new Set(progress.filter((p) => p.progress >= 1).map((p) => p.chapterId));
  const t = await getTranslations("learner.quests");

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader eyebrow={t("world_eyebrow")} title={world.name} description={world.description} />
      <ul className="grid gap-3" aria-label={t("chapters_aria")}>
        {await Promise.all(
          chapters.map(async (c) => {
            const unlocked = await isQuestChapterUnlocked(learnerId!, session.tenantId, c);
            const isDone = completed.has(c.id);
            const inner = (
              <Card
                className={`p-5 ${unlocked ? "hover:shadow-soft-3 transition-shadow" : "opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t("chapter_label", { order: c.order })}
                        {c.isBoss ? t("boss_suffix") : ""}
                      </span>
                      {isDone ? (
                        <Badge tone="success">{t("status_done")}</Badge>
                      ) : !unlocked ? (
                        <Badge tone="neutral">{t("status_locked")}</Badge>
                      ) : null}
                    </div>
                    <h2 className="text-lg font-semibold mt-1">{c.title}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{c.description}</p>
                  </div>
                </div>
              </Card>
            );
            if (!unlocked) {
              return (
                <li key={c.id} aria-disabled="true">
                  {inner}
                </li>
              );
            }
            return (
              <li key={c.id}>
                <Link
                  href={`/learner/quests/${worldId}/chapters/${c.id}`}
                  className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                >
                  {inner}
                </Link>
              </li>
            );
          }),
        )}
      </ul>
    </AppShell>
  );
}
