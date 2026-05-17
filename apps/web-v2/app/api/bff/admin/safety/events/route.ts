import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { listModerationEvents } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    const url = new URL(req.url);
    const decision = url.searchParams.get("decision") as
      | "allow"
      | "review"
      | "block"
      | null;
    // Platform admins see global events, others scoped to their tenant.
    const tenantId = session!.role === "platform_admin" ? undefined : session!.tenantId;
    const events = listModerationEvents({
      tenantId,
      decision: decision ?? undefined,
      limit: 200,
    });
    return ok({ events }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
