import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { getImpersonationHistory } from "@/lib/services/impersonation-svc";

export const dynamic = "force-dynamic";

/** GET — list Secure Impersonation sessions (graceful empty array on failure). */
export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin", "district_admin"], requestId);
    if (roleErr) return roleErr;

    const url = new URL(req.url);
    // Platform admins may pass ?adminId= to scope to one actor. Non-platform
    // callers are scoped to their own history by identity-svc regardless, so
    // we always pass their own userId as the floor.
    const adminId =
      session!.role === "platform_admin"
        ? url.searchParams.get("adminId") ?? undefined
        : session!.userId;

    const sessions = await getImpersonationHistory({ adminId, requestId });
    return ok({ sessions }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
