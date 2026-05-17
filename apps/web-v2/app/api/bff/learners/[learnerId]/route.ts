import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import {
  deleteLearner,
  getLearner,
  refreshLearnerReadiness,
  updateLearner,
} from "@/lib/db/repos";
import { patchLearnerSchema } from "@/lib/validators/learner";

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

    refreshLearnerReadiness(learnerId, session!.tenantId);
    const learner = getLearner(learnerId, session!.tenantId);
    if (!learner) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Learner not found" }, requestId);
    }
    return ok({ learner }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;

    const body = await req.json().catch(() => ({}));
    const parsed = patchLearnerSchema.safeParse(body);
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
    }
    const updated = updateLearner(learnerId, session!.tenantId, parsed.data);
    if (!updated) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Learner not found" }, requestId);
    }
    audit(session, "learner.update", requestId, {
      learnerId,
      metadata: { fields: Object.keys(parsed.data) },
    });
    return ok({ learner: updated }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function DELETE(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;

    const removed = deleteLearner(learnerId, session!.tenantId);
    if (!removed) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Learner not found" }, requestId);
    }
    audit(session, "learner.delete", requestId, { learnerId });
    return ok({ deleted: true }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
