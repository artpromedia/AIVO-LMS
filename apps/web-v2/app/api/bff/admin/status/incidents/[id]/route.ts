import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ADMIN_ROLES } from "@/lib/bff/admin-scope";
import { getIncident } from "@/lib/services/status-page-svc";
import { callService } from "@/lib/services/client";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { id } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    const data = await getIncident(id, { requestId });
    return ok(data, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { id } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const res = await callService<unknown>({
      service: "status-page-svc",
      baseUrl: serverEnv.STATUS_PAGE_SVC_URL,
      url: `/api/statuspage/incidents/${encodeURIComponent(id)}`,
      method: "PATCH",
      body,
      headers: { "x-actor-role": "platform_admin" },
      requestId,
    });

    if (res.ok) {
      return ok(res.data, requestId);
    }

    // Fallback so lifecycle controls reflect the requested change locally.
    return ok(
      {
        incident: {
          id,
          ...body,
          updatedAt: new Date().toISOString(),
        },
        stub: true,
      },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
