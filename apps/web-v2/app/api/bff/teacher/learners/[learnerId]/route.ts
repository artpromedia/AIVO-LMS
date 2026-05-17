import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import {
  getIEPForLearner,
  getLearner,
  getMasteryMap,
  listActiveAssignmentsForLearner,
  listLessonRunsForLearner,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

/**
 * GET /api/bff/teacher/learners/:learnerId
 *
 * Teacher-facing learner snapshot. **Never** exposes raw IEP text — only
 * `accommodationSummary.teacherSummary` (the consented, plain-language
 * version surfaced by Sprint 11). Same-tenant enforcement: if the learner
 * is in another tenant, this returns NOT_FOUND, not FORBIDDEN, to avoid
 * leaking existence across tenants.
 */
export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["teacher"], requestId);
    if (roleErr) return roleErr;
    const learner = getLearner(learnerId, session!.tenantId);
    if (!learner)
      return fail({ ...ERRORS.NOT_FOUND, message: "Learner not found." }, requestId);
    const recentRuns = listLessonRunsForLearner(learnerId, session!.tenantId, {
      limit: 10,
    });
    const mastery = getMasteryMap(learnerId, session!.tenantId);
    const iep = getIEPForLearner(learnerId, session!.tenantId);
    const assignments = listActiveAssignmentsForLearner(learnerId, session!.tenantId);
    return ok(
      {
        learner: {
          id: learner.id,
          displayName: learner.displayName,
          birthYear: learner.birthYear,
          readinessState: learner.readinessState,
          functioningLevel: learner.functioningLevel,
        },
        recentRuns: recentRuns.map((r) => ({
          id: r.id,
          subjectId: r.subjectId,
          skillId: r.skillId,
          status: r.status,
          source: r.source,
          startedAt: r.startedAt,
          completedAt: r.completedAt,
        })),
        mastery: mastery.map ?? null,
        accommodationSummary:
          iep && iep.extraction
            ? {
                // Only the teacher-safe slice — raw IEP text is never returned.
                teacherSummary: iep.extraction.teacherSummary,
                accommodations: iep.extraction.accommodations,
                updatedAt: iep.extraction.generatedAt,
              }
            : null,
        activeAssignments: assignments.map((a) => ({
          id: a.id,
          title: a.title,
          subjectId: a.subjectId,
          createdAt: a.createdAt,
          dueAt: a.dueAt,
        })),
      },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
