import { NextResponse } from "next/server";
import { failFromUnknown, fail, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { parentCanAccessLearner, listProvidersForLearner } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

/** Providers (coach / therapist) assigned to a learner — the bookable list. */
export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { learnerId } = await params;
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    if (!(await parentCanAccessLearner(session!.userId, learnerId, session!.tenantId))) {
      return fail({ ...ERRORS.FORBIDDEN_LEARNER, message: "not your learner" }, requestId);
    }
    const providers = listProvidersForLearner(learnerId, session!.tenantId).map((p) => ({
      id: p.id,
      kind: p.kind,
      displayName: p.displayName,
      specialty: p.specialty,
      bio: p.bio,
      timezone: p.timezone,
      availability: p.availability,
    }));
    return ok({ providers }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
