import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { audit } from "@/lib/bff/audit";
import {
  completeBaseline,
  getBaselineById,
  refreshLearnerReadiness,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string; baselineId: string }> };

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId, baselineId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "learner"], requestId);
    if (roleErr) return roleErr;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = requireLearnerConsent(session!, learnerId, ["child_data_collection"], requestId);
    if (consentErr) return consentErr;

    const existing = getBaselineById(baselineId, session!.tenantId);
    if (!existing || existing.learnerId !== learnerId) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Baseline not found" }, requestId);
    }
    const result = completeBaseline(baselineId, session!.tenantId);
    if (!result) {
      return fail(
        { ...ERRORS.INTERNAL_ERROR, message: "Could not complete baseline" },
        requestId,
      );
    }
    refreshLearnerReadiness(learnerId, session!.tenantId);
    audit(session, "baseline.complete", requestId, {
      learnerId,
      metadata: {
        baselineId,
        correct: result.summary.correctCount,
        answered: result.summary.totalAnswered,
        total: result.summary.totalQuestions,
        skillMasteryCount: result.skillMasteries.length,
        learningPathNodeCount: result.learningPath.nodes.length,
        brainCloned: Boolean(result.clonedBrainProfile),
        brainCloneStage: result.clonedBrainProfile?.cloneStage ?? null,
      },
    });
    return ok(result, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
