import { NextResponse } from "next/server";
import { failFromUnknown, fail, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { serverEnv } from "@/lib/env";
import { callService } from "@/lib/services/client";
import { REPORTS_ROLES, reportsAuthHeaders, upstreamFail } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...REPORTS_ROLES], requestId);
    if (roleErr) return roleErr;

    const { id } = await params;
    const res = await callService<unknown>({
      service: "reports-svc",
      baseUrl: serverEnv.REPORTS_SVC_URL,
      url: `/api/reports/${encodeURIComponent(id)}/schema`,
      headers: reportsAuthHeaders(session!),
      requestId,
    });
    if (!res.ok) return upstreamFail(res, requestId, fail);
    return ok(res.data, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
