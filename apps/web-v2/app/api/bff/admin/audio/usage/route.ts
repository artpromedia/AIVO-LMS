import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { listReadAloudUsage, summarizeAudioUsage } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    const tenantId = session!.role === "platform_admin" ? undefined : session!.tenantId;
    const summary = summarizeAudioUsage(tenantId);
    const events = listReadAloudUsage(tenantId).slice(0, 200);
    return ok({ summary, events }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
