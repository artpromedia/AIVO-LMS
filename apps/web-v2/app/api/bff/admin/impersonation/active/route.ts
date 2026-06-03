import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession } from "@/lib/bff/guards";
import { getImpersonationState } from "@/lib/impersonation/state";

export const dynamic = "force-dynamic";

/**
 * GET — return the current active impersonation state from the
 * `aivo_impersonation` cookie (or null if none / expired).
 */
export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    void session;
    const state = await getImpersonationState();
    return ok({ active: state }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
