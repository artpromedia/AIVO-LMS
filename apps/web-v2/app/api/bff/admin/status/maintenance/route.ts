import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ADMIN_ROLES } from "@/lib/bff/admin-scope";
import { listMaintenances } from "@/lib/services/status-page-svc";
import { callService } from "@/lib/services/client";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    const maintenances = await listMaintenances({ requestId });
    return ok({ maintenances }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const res = await callService<unknown>({
      service: "status-page-svc",
      baseUrl: serverEnv.STATUS_PAGE_SVC_URL,
      url: "/api/statuspage/maintenances",
      method: "POST",
      body,
      headers: { "x-actor-role": "platform_admin" },
      requestId,
    });

    if (res.ok) {
      return ok(res.data, requestId);
    }

    // No fabricated fallback: a maintenance window that didn't reach
    // status-page-svc must surface as a typed error, not a synthetic
    // synthetic local record that was never actually scheduled upstream.
    return fail(
      {
        code: "upstream_unavailable",
        message: `status-page-svc rejected maintenance create (status ${res.status}).`,
        userMessage: "Could not schedule maintenance — the status page service is unavailable.",
        status: 502,
      },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
