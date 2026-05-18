import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import {
  getQuestWorld,
  isQuestChapterUnlocked,
  listQuestChapters,
  listQuestProgressForLearner,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string; worldId: string }> };

/**
 * GET /api/bff/learners/:learnerId/quests/:worldId
 *
 * Returns the world + chapter map decorated with per-learner unlock state
 * and completion. Boss chapters carry `isBoss: true` and inherit
 * `unlocked: false` until prerequisites finish.
 */
export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId, worldId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "learner", "teacher"], requestId);
    if (roleErr) return roleErr;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection", "ai_personalization"],
      requestId,
    );
    if (consentErr) return consentErr;

    const world = getQuestWorld(worldId);
    if (!world) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Quest world not found" }, requestId);
    }
    const chapters = listQuestChapters(worldId);
    const progress = listQuestProgressForLearner(learnerId, session!.tenantId, worldId);
    const progressByChapter = new Map(progress.map((p) => [p.chapterId, p]));
    const decorated = chapters.map((c) => ({
      ...c,
      unlocked: isQuestChapterUnlocked(learnerId, session!.tenantId, c),
      completed: (progressByChapter.get(c.id)?.progress ?? 0) >= 1,
    }));
    return ok({ world, chapters: decorated }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
