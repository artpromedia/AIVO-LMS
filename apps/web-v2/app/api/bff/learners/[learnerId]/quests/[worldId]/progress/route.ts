import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { getQuestWorld, listQuestChapters, listQuestProgressForLearner } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string; worldId: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId, worldId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "learner", "teacher"], requestId);
    if (roleErr) return roleErr;
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection"],
      requestId,
    );
    if (consentErr) return consentErr;

    const world = await getQuestWorld(worldId);
    if (!world) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Quest world not found" }, requestId);
    }
    const chapters = await listQuestChapters(worldId);
    const normal = chapters.filter((c) => !c.isBoss);
    const boss = chapters.find((c) => c.isBoss);
    const progress = await listQuestProgressForLearner(learnerId, session!.tenantId, worldId);
    const completedIds = new Set(progress.filter((p) => p.progress >= 1).map((p) => p.chapterId));
    return ok(
      {
        worldId,
        chaptersTotal: normal.length,
        chaptersCompleted: normal.filter((c) => completedIds.has(c.id)).length,
        bossDone: boss ? completedIds.has(boss.id) : false,
        bossUnlocked: boss
          ? boss.prerequisiteChapterIds.every((id) => completedIds.has(id))
          : false,
        progress,
      },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
