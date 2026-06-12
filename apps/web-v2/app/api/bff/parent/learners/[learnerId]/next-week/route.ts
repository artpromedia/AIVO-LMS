import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { getPersistence } from "@/lib/db/persistence";

/**
 * Remediation Sprint 07 — the parent "Next week" view.
 *
 * Lists the learner's pre-generated (ready) lessons — the coming week the
 * Sunday-night Creator prepared — joined to subject/skill names so the
 * parent sees WHAT is planned before the learner plays it. Read-only.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "teacher"], requestId);
    if (roleErr) return roleErr;
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;

    const persistence = getPersistence();
    const learner = await persistence.learners.getById(learnerId, session!.tenantId);
    if (!learner) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Learner not found" }, requestId);
    }
    const runs = await persistence.lessonRuns.listForLearner(learnerId, session!.tenantId, {
      limit: 50,
      status: "ready",
    });
    const lessons = await Promise.all(
      runs.map(async (run) => {
        const subject = await persistence.curriculum.getSubjectById(run.subjectId);
        const skill = await persistence.curriculum.getSkillById(run.skillId);
        return {
          lessonRunId: run.id,
          subjectId: run.subjectId,
          subjectName: subject?.name ?? run.subjectId,
          skillId: run.skillId,
          skillName: skill?.name ?? run.skillId,
          source: run.source,
          preGenerated: run.source === "weekly_creator",
          createdAt: run.createdAt,
        };
      }),
    );
    lessons.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return ok({ lessons }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
