import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { getLearner, refreshLearnerReadiness } from "@/lib/db/repos";
import { READINESS_LABEL, nextStepFor } from "@/lib/learner/readiness";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(
      session!,
      ["parent", "learner", "teacher", "school_admin"],
      requestId,
    );
    if (roleErr) return roleErr;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection"],
      requestId,
    );
    if (consentErr) return consentErr;

    const learner = await getLearner(learnerId, session!.tenantId);
    if (!learner) return fail({ ...ERRORS.NOT_FOUND, message: "Learner not found" }, requestId);
    const state = await refreshLearnerReadiness(learnerId, session!.tenantId);
    if (!state) return fail({ ...ERRORS.NOT_FOUND, message: "Learner not found" }, requestId);
    const next = nextStepFor({ id: learnerId, readinessState: state });
    return ok(
      {
        learnerId,
        state,
        label: READINESS_LABEL[state],
        nextStep: next,
      },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
