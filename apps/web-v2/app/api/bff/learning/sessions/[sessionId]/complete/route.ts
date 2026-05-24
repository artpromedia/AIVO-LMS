/**
 * BFF proxy for `POST /api/learning/sessions/:sessionId/complete`.
 * Returns the upstream xpEarned + completionQuality so the v2 player
 * can drop the learner back to /learner/home with a meaningful toast.
 */
import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { getServerLearningClient } from "@/lib/bff/learning-svc";
import { audit } from "@/lib/bff/audit";
import { CompleteSessionRequest, LearningClientError } from "@aivo/api-client/learning";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ sessionId: string }> };

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { sessionId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "learner", "teacher"], requestId);
    if (roleErr) return roleErr;

    const raw = await req.json().catch(() => ({}));
    const parsed = CompleteSessionRequest.safeParse(raw);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid complete body",
        },
        requestId,
      );
    }

    const client = getServerLearningClient(req.headers.get("authorization"));
    const completed = await client.completeSession(sessionId, parsed.data);

    audit(session!, "learning.session.complete", requestId, {
      metadata: {
        sessionId,
        xpEarned: completed.xpEarned,
        completionQuality: completed.completionQuality,
      },
    });
    return ok(completed, requestId);
  } catch (e) {
    if (e instanceof LearningClientError) {
      return fail({ ...ERRORS.UPSTREAM_UNAVAILABLE, message: e.message }, requestId);
    }
    return failFromUnknown(e, requestId);
  }
}
