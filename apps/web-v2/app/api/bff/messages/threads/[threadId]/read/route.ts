import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok, fail } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession } from "@/lib/bff/guards";
import { isCommsSvcEnabled, getCommsBearer, markThreadReadSvc } from "@/lib/bff/comms-svc";
import { markRead } from "@/lib/db/messages-store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ threadId: string }> };

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { threadId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;

    const bearer = await getCommsBearer();
    if (isCommsSvcEnabled() && bearer) {
      const r = await markThreadReadSvc(bearer, threadId);
      if (!r.ok) {
        return fail(
          { ...ERRORS.UPSTREAM_UNAVAILABLE, message: r.error, status: r.status >= 500 ? 502 : r.status },
          requestId,
        );
      }
      return ok({ ok: true }, requestId);
    }
    markRead(threadId, session!.tenantId, session!.userId);
    return ok({ ok: true }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
