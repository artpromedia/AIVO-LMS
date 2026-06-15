import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { failSession } from "@/lib/bff/session-errors";
import { cancelSession } from "@/lib/db/repos";

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

    const json = (await req.json().catch(() => ({}))) as { reason?: unknown };
    const reason = typeof json.reason === "string" ? json.reason : undefined;

    const result = await cancelSession({
      sessionId,
      tenantId: session!.tenantId,
      parentUserId: session!.userId,
      reason,
    });
    if (!result.ok) return failSession(result, requestId);

    audit(session, "session.cancel", requestId, {
      learnerId: result.session.learnerId,
      metadata: { sessionId },
    });
    return ok({ session: { id: result.session.id, status: result.session.status } }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
