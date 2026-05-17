import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import {
  requireSession,
  requireRole,
  requireLearnerScope,
} from "@/lib/bff/guards";
import {
  listQuestChapters,
  listQuestProgressForLearner,
  listQuestWorlds,
} from "@/lib/db/repos";

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

    const worlds = listQuestWorlds();
    const progress = listQuestProgressForLearner(learnerId, session!.tenantId);
    const completedChapterIds = new Set(
      progress.filter((p) => p.progress >= 1).map((p) => p.chapterId),
    );
    const worldsWithProgress = worlds.map((w) => {
      const chapters = listQuestChapters(w.id);
      const normal = chapters.filter((c) => !c.isBoss);
      const boss = chapters.find((c) => c.isBoss);
      const chaptersCompleted = normal.filter((c) =>
        completedChapterIds.has(c.id),
      ).length;
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
    });
    return ok({ worlds: worldsWithProgress }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
