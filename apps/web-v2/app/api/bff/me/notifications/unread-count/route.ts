import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession } from "@/lib/bff/guards";
import { listNotifications } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

/**
 * GET /api/bff/me/notifications/unread-count
 *
 * Returns the unread notification count for the signed-in user. Used by
 * the learner sidebar badge in LEARNER_NAV, but role-agnostic so any
 * dashboard can adopt the same indicator without bespoke routes.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const unreadList = await listNotifications({
      tenantId: session!.tenantId,
      userId: session!.userId,
      unreadOnly: true,
    });
    const unread = unreadList.length;
    return ok({ unread }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
