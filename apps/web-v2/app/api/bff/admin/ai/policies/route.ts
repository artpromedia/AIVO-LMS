import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ADMIN_ROLES } from "@/lib/bff/admin-scope";
import { listPolicies } from "@/lib/services/responsible-ai-svc";
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
    return ok({ policies: await listPolicies({ requestId }) }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function PUT(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: "id is required." }, requestId);
    }
    const { id: _id, ...patch } = body;

    const res = await callService<{ policy: unknown }>({
      service: "responsible-ai-svc",
      baseUrl: serverEnv.RESPONSIBLE_AI_SVC_URL,
      method: "PUT",
      url: `/api/responsible-ai/policies/${encodeURIComponent(id)}`,
      body: patch,
      headers: { "x-actor-role": "platform_admin" },
      requestId,
    });

    if (!res.ok) {
      return fail(
        {
          ...ERRORS.UPSTREAM_UNAVAILABLE,
          message: res.message || "Failed to update policy upstream.",
        },
        requestId,
      );
    }

    return ok({ policy: (res.data as Record<string, unknown>).policy ?? res.data }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
