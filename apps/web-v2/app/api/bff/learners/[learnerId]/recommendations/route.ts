/**
 * Sprint 5: GET /api/bff/learners/:learnerId/recommendations
 *
 * Lists the learner's profile recommendations (pending first, plus recent
 * decided history) for the parent approval panel. Parent-only; learner
 * scope + consent enforced like sibling learner routes.
 */
import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { listRecommendationsForLearner } from "@/lib/bff/recommendation-svc";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection", "ai_personalization"],
      requestId,
    );
    if (consentErr) return consentErr;

    const result = await listRecommendationsForLearner(
      { userId: session!.userId, tenantId: session!.tenantId },
      learnerId,
    );
    return ok(result, requestId);
  } catch (e) {
    if (e instanceof Error && /recommendation-svc list failed/.test(e.message)) {
      return fail(
        {
          ...ERRORS.UPSTREAM_UNAVAILABLE,
          message: e.message,
          userMessage: "Recommendations are unavailable right now — try again shortly.",
        },
        requestId,
      );
    }
    return failFromUnknown(e, requestId);
  }
}
