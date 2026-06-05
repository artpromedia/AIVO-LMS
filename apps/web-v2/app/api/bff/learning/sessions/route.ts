/**
 * BFF proxy for `POST /api/learning/sessions` — the create-session
 * endpoint the v2 lesson player relies on. Forwards to
 * `services/learning-svc` via the typed client, with auth/tenant/role
 * checks applied locally so the BFF stays the security boundary even
 * when the upstream service is slow or unavailable.
 */
import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { getServerLearningClient } from "@/lib/bff/learning-svc";
import { audit } from "@/lib/bff/audit";
import { CreateSessionRequest } from "@aivo/api-client/learning";
import { LearningClientError } from "@aivo/api-client/learning";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "learner", "teacher"], requestId);
    if (roleErr) return roleErr;

    const raw = await req.json().catch(() => ({}));
    const parsed = CreateSessionRequest.safeParse(raw);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid create-session body",
        },
        requestId,
      );
    }
    const scope = await requireLearnerScope(session!, parsed.data.learnerId, requestId);
    if (scope) return scope;
    const consentErr = await requireLearnerConsent(
      session!,
      parsed.data.learnerId,
      ["child_data_collection", "ai_personalization"],
      requestId,
    );
    if (consentErr) return consentErr;

    const client = getServerLearningClient(req.headers.get("authorization"));
    const created = await client.createSession(parsed.data);

    audit(session!, "learning.session.create", requestId, {
      learnerId: parsed.data.learnerId,
      metadata: { sessionId: created.sessionId, status: created.status },
    });
    return ok(created, requestId);
  } catch (e) {
    if (e instanceof LearningClientError) {
      return fail(
        {
          ...ERRORS.UPSTREAM_UNAVAILABLE,
          message: e.message,
        },
        requestId,
      );
    }
    return failFromUnknown(e, requestId);
  }
}
