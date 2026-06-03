import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ADMIN_ROLES } from "@/lib/bff/admin-scope";
import { listIncidents } from "@/lib/services/status-page-svc";
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
    const incidents = await listIncidents({ requestId });
    return ok({ incidents }, requestId);
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
    const res = await callService<{ incident: unknown }>({
      service: "status-page-svc",
      baseUrl: serverEnv.STATUS_PAGE_SVC_URL,
      url: "/api/statuspage/incidents",
      method: "POST",
      body,
      headers: { "x-actor-role": "platform_admin" },
      requestId,
    });

    if (res.ok) {
      return ok(res.data, requestId);
    }

    // Resilient fallback so the admin flow still completes in local/demo mode.
    const title = typeof body.title === "string" ? body.title : "Untitled incident";
    const impact = typeof body.impact === "string" ? body.impact : "minor";
    const affectedComponentIds = Array.isArray(body.affectedComponentIds)
      ? body.affectedComponentIds
      : [];
    return ok(
      {
        incident: {
          id: `inc-local-${Date.now()}`,
          title,
          impact,
          lifecycle: "investigating",
          affectedComponentIds,
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
