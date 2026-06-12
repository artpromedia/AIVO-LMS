/**
 * GET /api/bff/learners/:learnerId/sensory
 *
 * Read the parent-curated sensory profile (five modalities, hyper/neutral/
 * hypo) that drives the stage's sensory adaptations. The lesson player loads
 * this server-side through the repos layer; this route exists for client
 * surfaces (and the mobile app's web fallback) that need the same data over
 * HTTP without ever talking to a service URL directly.
 *
 * Guard stack mirrors the accessibility route: session → role → learner
 * scope → child_data_collection consent.
 */
import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { getLearner, getLearnerSensoryProfile } from "@/lib/db/repos";

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
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection"],
      requestId,
    );
    if (consentErr) return consentErr;
    if (!(await getLearner(learnerId, session!.tenantId))) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Learner not found" }, requestId);
    }
    const profile = await getLearnerSensoryProfile(learnerId, session!.tenantId);
    return ok({ sensory: profile }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
