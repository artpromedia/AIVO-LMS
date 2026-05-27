import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { audit } from "@/lib/bff/audit";
import { regenerateLearningPath } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "teacher"], requestId);
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

    const path = regenerateLearningPath(learnerId, session!.tenantId);
    if (!path) {
      return fail(
        {
          ...ERRORS.PRECONDITION_FAILED,
          message: "Mastery map missing — complete the baseline first",
          userMessage: "Finish the baseline so we have something to plan from.",
        },
        requestId,
      );
    }
    audit(session, "learning_path.regenerate", requestId, {
      learnerId,
      metadata: { nodeCount: path.nodes.length },
    });
    return ok({ learningPath: path }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
