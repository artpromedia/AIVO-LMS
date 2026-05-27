import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import {
  getBrainProfile,
  getIEPForLearner,
  getLearner,
  getOrCreateParentAssessment,
  listSubjects,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

/**
 * GET /api/bff/learners/:learnerId/context
 *
 * Returns the aggregated learner-context object: profile + parent assessment
 * + IEP extraction + brain profile snapshot. Consumed by baseline (Sprint 8)
 * and lesson generation (Sprint 9+).
 */
export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "teacher", "school_admin"], requestId);
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

    const learner = getLearner(learnerId, session!.tenantId);
    if (!learner) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Learner not found" }, requestId);
    }
    const assessment = getOrCreateParentAssessment(learnerId, session!.tenantId);
    const iep = getIEPForLearner(learnerId, session!.tenantId);
    const brainProfile = getBrainProfile(learnerId, session!.tenantId);
    return ok(
      {
        learner,
        parentAssessment: assessment,
        iep,
        brainProfile,
        subjects: listSubjects(),
      },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
