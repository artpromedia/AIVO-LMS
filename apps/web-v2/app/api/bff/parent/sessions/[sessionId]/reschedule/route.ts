import { NextResponse } from "next/server";
import { failFromUnknown, fail, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { failSession } from "@/lib/bff/session-errors";
import { rescheduleSession, getProvider, getLearner } from "@/lib/db/repos";
import { notifySessionUpcoming } from "@/lib/parent/session-notify";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ sessionId: string }> };

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { sessionId } = await params;
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;

    const json = (await req.json().catch(() => ({}))) as { newStart?: unknown };
    const newStart = typeof json.newStart === "string" ? json.newStart : "";
    if (!newStart) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: "newStart is required" }, requestId);
    }

    const result = await rescheduleSession({
      sessionId,
      tenantId: session!.tenantId,
      parentUserId: session!.userId,
      newStart,
    });
    if (!result.ok) return failSession(result, requestId);

    const learner = await getLearner(result.session.learnerId, session!.tenantId);
    const provider = getProvider(result.session.providerId, session!.tenantId);
    await notifySessionUpcoming({
      parentUserId: session!.userId,
      learnerName: learner?.displayName ?? "your learner",
      providerName: provider?.displayName ?? "your provider",
    });
    audit(session, "session.reschedule", requestId, {
      learnerId: result.session.learnerId,
      metadata: { sessionId, newStart },
    });
    return ok({ session: { id: result.session.id, scheduledStart: result.session.scheduledStart } }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
