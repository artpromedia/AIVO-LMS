import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { listQuestChapters, listQuestProgressForLearner, listQuestWorlds } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

/**
 * GET /api/bff/learners/:learnerId/quests
 *
 * Returns every quest world with a per-world progress summary
 * (chaptersCompleted / chaptersTotal, plus bossUnlocked).
 */
export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "learner", "teacher"], requestId);
    if (roleErr) return roleErr;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection", "ai_personalization"],
      requestId,
    );
    if (consentErr) return consentErr;

    const worlds = await listQuestWorlds();
    const progress = await listQuestProgressForLearner(learnerId, session!.tenantId);
    const completedChapterIds = new Set(
      progress.filter((p) => p.progress >= 1).map((p) => p.chapterId),
    );
    const worldsWithProgress = await Promise.all(
      worlds.map(async (w) => {
        const chapters = await listQuestChapters(w.id);
        const normal = chapters.filter((c) => !c.isBoss);
        const boss = chapters.find((c) => c.isBoss);
        const chaptersCompleted = normal.filter((c) => completedChapterIds.has(c.id)).length;
        const bossDone = boss ? completedChapterIds.has(boss.id) : false;
        const bossUnlocked = boss
          ? boss.prerequisiteChapterIds.every((id) => completedChapterIds.has(id))
          : false;
        return {
          ...w,
          chaptersTotal: normal.length,
          chaptersCompleted,
          hasBoss: Boolean(boss),
          bossUnlocked,
          bossDone,
        };
      }),
    );
    return ok({ worlds: worldsWithProgress }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
