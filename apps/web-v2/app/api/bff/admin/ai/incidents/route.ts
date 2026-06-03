import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ADMIN_ROLES } from "@/lib/bff/admin-scope";
import { listIncidents } from "@/lib/services/responsible-ai-svc";
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
    return ok({ incidents: await listIncidents({ requestId }) }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const res = await callService<{ incident: unknown }>({
      service: "responsible-ai-svc",
      baseUrl: serverEnv.RESPONSIBLE_AI_SVC_URL,
      method: "POST",
      url: "/api/responsible-ai/incidents",
      body,
      headers: {
        "x-actor-role": session!.role,
        "x-tenant-id": session!.tenantId ?? "",
      },
      requestId,
    });

    if (!res.ok) {
      return fail(
        {
          ...ERRORS.UPSTREAM_UNAVAILABLE,
          message: res.message || "Failed to file incident upstream.",
        },
        requestId,
      );
    }

    return ok({ incident: (res.data as any).incident ?? res.data }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
