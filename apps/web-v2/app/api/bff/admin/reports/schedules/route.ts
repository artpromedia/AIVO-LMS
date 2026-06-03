import { NextResponse } from "next/server";
import { failFromUnknown, fail, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { serverEnv } from "@/lib/env";
import { callService } from "@/lib/services/client";
import { REPORTS_ROLES, reportsAuthHeaders, upstreamFail } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...REPORTS_ROLES], requestId);
    if (roleErr) return roleErr;

    const res = await callService<unknown>({
      service: "reports-svc",
      baseUrl: serverEnv.REPORTS_SVC_URL,
      url: "/api/reports/schedules",
      headers: reportsAuthHeaders(session!),
      requestId,
    });
    if (!res.ok) return upstreamFail(res, requestId, fail);
    return ok(res.data, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...REPORTS_ROLES], requestId);
    if (roleErr) return roleErr;

    const body = await req.json().catch(() => ({}));
    const verified = req.headers.get("x-verified-recipients");
    const res = await callService<unknown>({
      service: "reports-svc",
      baseUrl: serverEnv.REPORTS_SVC_URL,
      url: "/api/reports/schedules",
      method: "POST",
      body,
      headers: {
        ...reportsAuthHeaders(session!),
        ...(verified ? { "x-verified-recipients": verified } : {}),
      },
      requestId,
      retries: 0,
    });
    if (!res.ok) return upstreamFail(res, requestId, fail);
    return ok(res.data, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
