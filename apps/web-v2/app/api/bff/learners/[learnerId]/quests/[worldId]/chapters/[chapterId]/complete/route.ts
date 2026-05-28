import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { getQuestProgress, getQuestWorld } from "@/lib/db/repos";
import { getStore } from "@/lib/db/store";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ learnerId: string; worldId: string; chapterId: string }>;
};

/**
 * POST /api/bff/learners/:learnerId/quests/:worldId/chapters/:chapterId/complete
 *
 * Idempotent finisher. The canonical completion path is the lesson player
 * calling `POST /lesson-runs/:id/complete` — that already bumps quest
 * progress via `upsertQuestProgressFromCompletion`. This route is a manual
 * "finish the chapter" affordance: it finds the latest quest LessonRun for
 * (learner, chapter) and completes it through the same authoritative path
 * (so checks/hints/scaffolds are derived from recorded interactions, not
 * trusted from the client). Returns the QuestProgress snapshot.
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
    const consentErr = await requireLearnerConsent(
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
    // Progress is only advanced by the canonical lesson-run completion path
    // (`POST /lesson-runs/:id/complete`), which derives the outcome from
    // recorded interactions and then calls `upsertQuestProgressFromCompletion`.
    // This route is a read-only progress surfacer that also asserts the
    // chapter's latest run is genuinely completed — calling it before the
    // lesson player has finished the run returns 412 instead of silently
    // marking the run complete. This closes the "fake completion" bypass.
    let latestRun: { status: string } | null = null;
    let latestStamp = "";
    for (const r of getStore().lessonRuns.values()) {
      if (
        r.tenantId === session!.tenantId &&
        r.learnerId === learnerId &&
        r.source === "quest" &&
        r.sourceRefId === chapterId &&
        r.createdAt > latestStamp
      ) {
        latestStamp = r.createdAt;
        latestRun = r;
      }
    }
    if (!latestRun) {
      return fail(
        {
          ...ERRORS.PRECONDITION_FAILED,
          message: "Start the chapter before completing it.",
        },
        requestId,
      );
    }
    if (latestRun.status !== "completed") {
      return fail(
        {
          ...ERRORS.PRECONDITION_FAILED,
          message:
            "Finish the chapter's lesson before marking it complete. Progress is only counted when the lesson player completes the run.",
        },
        requestId,
      );
    }
    const progress = getQuestProgress(learnerId, session!.tenantId, chapterId);
    return ok({ progress, alreadyCompleted: true }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
