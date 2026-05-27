import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { getBaselineById, listBaselineAttempts, listBaselineQuestions } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string; baselineId: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId, baselineId } = await params;
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

    const baseline = await getBaselineById(baselineId, session!.tenantId);
    if (!baseline || baseline.learnerId !== learnerId) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Baseline not found" }, requestId);
    }
    const questions = await listBaselineQuestions(baseline.id);
    const attempts = await listBaselineAttempts(baseline.id, session!.tenantId);
    return ok({ baseline, questions, attempts }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
