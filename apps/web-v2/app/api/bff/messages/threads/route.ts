import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession } from "@/lib/bff/guards";
import { isCommsSvcEnabled, getCommsBearer, listThreadsSvc } from "@/lib/bff/comms-svc";
import { listThreads } from "@/lib/db/messages-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;

    const bearer = await getCommsBearer();
    if (isCommsSvcEnabled() && bearer) {
      const r = await listThreadsSvc(bearer);
      if (!r.ok) {
        return fail(
          {
            ...ERRORS.UPSTREAM_UNAVAILABLE,
            message: r.error,
            status: r.status >= 500 ? 502 : r.status,
          },
          requestId,
        );
      }
      return ok(r.data, requestId);
    }
    return ok({ threads: listThreads(session!.tenantId, session!.userId) }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
