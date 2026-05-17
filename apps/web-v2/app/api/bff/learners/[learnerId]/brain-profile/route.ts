import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { getBrainProfile } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "teacher", "school_admin"], requestId);
    if (roleErr) return roleErr;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const profile = getBrainProfile(learnerId, session!.tenantId);
    if (!profile) {
      return fail(
        { ...ERRORS.NOT_FOUND, message: "Brain profile not generated yet" },
        requestId,
      );
    }
    return ok({ brainProfile: profile }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
