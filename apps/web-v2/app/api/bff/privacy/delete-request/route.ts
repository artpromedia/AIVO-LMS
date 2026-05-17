import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import {
  createDataDeletionRequest,
  listDataDeletionRequestsForUser,
} from "@/lib/db/repos";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  learnerId: z.string().min(1).max(64).nullable().optional(),
  scope: z.enum(["account", "learner", "iep_only"]),
  notes: z.string().max(2000).optional(),
});

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    return ok(
      {
        requests: listDataDeletionRequestsForUser(
          session!.userId,
          session!.tenantId,
        ),
      },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid request body.",
        },
        requestId,
      );
    }
    const learnerId = parsed.data.learnerId ?? null;

    // learner / iep_only scope requires a real learnerId the parent owns.
    if (
      (parsed.data.scope === "learner" || parsed.data.scope === "iep_only") &&
      !learnerId
    ) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: "scope 'learner' and 'iep_only' require learnerId.",
        },
        requestId,
      );
    }
    if (learnerId) {
      const scope = requireLearnerScope(session!, learnerId, requestId);
      if (scope) return scope;
    }
    const rec = createDataDeletionRequest({
      tenantId: session!.tenantId,
      parentUserId: session!.userId,
      learnerId,
      scope: parsed.data.scope,
      notes: parsed.data.notes ?? null,
    });
    audit(session!, "privacy.delete_request.created", requestId, {
      learnerId,
      metadata: { requestId: rec.id, scope: rec.scope },
    });
    return ok({ request: rec }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
