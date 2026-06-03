import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ADMIN_ROLES } from "@/lib/bff/admin-scope";
import { listOptOuts } from "@/lib/services/responsible-ai-svc";
import { callService } from "@/lib/services/client";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

function actorHeaders(session: { role: string; tenantId?: string | null }): Record<string, string> {
  return {
    "x-actor-role": session.role,
    "x-tenant-id": session.tenantId ?? "",
  };
}

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    const tenantId = new URL(req.url).searchParams.get("tenantId") ?? undefined;
    return ok({ optOuts: await listOptOuts(tenantId, { requestId }) }, requestId);
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

    const res = await callService<{ optOut: unknown }>({
      service: "responsible-ai-svc",
      baseUrl: serverEnv.RESPONSIBLE_AI_SVC_URL,
      method: "POST",
      url: "/api/responsible-ai/optouts",
      body,
      headers: actorHeaders(session!),
      requestId,
    });

    if (!res.ok) {
      return fail(
        {
          ...ERRORS.UPSTREAM_UNAVAILABLE,
          message: res.message || "Failed to create opt-out upstream.",
        },
        requestId,
      );
    }

    return ok({ optOut: (res.data as any).optOut ?? res.data }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    const params = new URL(req.url).searchParams;
    const id = params.get("id");
    if (!id) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: "id is required." }, requestId);
    }

    const res = await callService<unknown>({
      service: "responsible-ai-svc",
      baseUrl: serverEnv.RESPONSIBLE_AI_SVC_URL,
      method: "DELETE",
      url: `/api/responsible-ai/optouts/${encodeURIComponent(id)}`,
      headers: actorHeaders(session!),
      requestId,
    });

    if (!res.ok) {
      return fail(
        {
          ...ERRORS.UPSTREAM_UNAVAILABLE,
          message: res.message || "Failed to remove opt-out upstream.",
        },
        requestId,
      );
    }

    return ok({ removed: true }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
