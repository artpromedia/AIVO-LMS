import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession } from "@/lib/bff/guards";
import { listNotifications } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get("unread") === "1";
    const notifications = await listNotifications({
      tenantId: session!.tenantId,
      userId: session!.userId,
      unreadOnly,
    });
    return ok(
      { notifications, unreadCount: notifications.filter((n) => !n.readAt).length },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
