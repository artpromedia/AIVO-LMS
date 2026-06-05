/**
 * Sprint 15: POST /api/bff/learners/:learnerId/accessibility/reset
 *
 * Restores defaults for the learner. Returns the defaults record so callers
 * can re-render without an extra GET.
 */
import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { audit } from "@/lib/bff/audit";
import { getLearner, resetAccessibilityPrefs } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "learner", "teacher"], requestId);
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
    if (!getLearner(learnerId, session!.tenantId)) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Learner not found" }, requestId);
    }
    const next = resetAccessibilityPrefs(learnerId, session!.tenantId);
    audit(session!, "accessibility.reset", requestId, { learnerId });
    return ok({ accessibility: next }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
