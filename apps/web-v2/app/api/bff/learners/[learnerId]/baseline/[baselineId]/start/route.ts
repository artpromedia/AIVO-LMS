import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { getBaselineById, startBaseline } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string; baselineId: string }> };

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId, baselineId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "learner"], requestId);
    if (roleErr) return roleErr;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;

    const existing = getBaselineById(baselineId, session!.tenantId);
    if (!existing || existing.learnerId !== learnerId) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Baseline not found" }, requestId);
    }
    const next = startBaseline(baselineId, session!.tenantId);
    if (!next) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Baseline not found" }, requestId);
    }
    audit(session, "baseline.start", requestId, { learnerId, metadata: { baselineId } });
    return ok({ baseline: next }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
