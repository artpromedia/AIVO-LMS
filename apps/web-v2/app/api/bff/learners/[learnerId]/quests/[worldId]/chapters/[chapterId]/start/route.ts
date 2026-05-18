import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { audit } from "@/lib/bff/audit";
import { startQuestChapter } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ learnerId: string; worldId: string; chapterId: string }>;
};

/**
 * POST /api/bff/learners/:learnerId/quests/:worldId/chapters/:chapterId/start
 *
 * Idempotent: if there's already an in-progress quest LessonRun for this
 * chapter, returns it; otherwise creates a new one. Locked chapters return
 * PRECONDITION_FAILED instead of silently creating a run.
 */
export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId, worldId, chapterId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "learner"], requestId);
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

    const result = await startQuestChapter({
      learnerId,
      tenantId: session!.tenantId,
      worldId,
      chapterId,
    });
    if (!result.ok) {
      const errBase =
        result.code === "chapter_not_found"
          ? ERRORS.NOT_FOUND
          : result.code === "locked"
            ? ERRORS.PRECONDITION_FAILED
            : ERRORS.INTERNAL_ERROR;
      return fail({ ...errBase, message: result.message }, requestId);
    }
    audit(session!, "quest.chapter_start", requestId, {
      learnerId,
      metadata: { worldId, chapterId, lessonRunId: result.lessonRunId },
    });
    return ok({ lessonRunId: result.lessonRunId }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
