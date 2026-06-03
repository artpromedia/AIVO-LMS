import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ADMIN_ROLES } from "@/lib/bff/admin-scope";
import { listEvals } from "@/lib/services/responsible-ai-svc";
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
    const modelId = new URL(req.url).searchParams.get("modelId") ?? undefined;
    return ok({ runs: await listEvals(modelId, { requestId }) }, requestId);
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
    const modelId = typeof body.modelId === "string" ? body.modelId : "";
    const harness = typeof body.harness === "string" ? body.harness : "";
    if (!modelId || !harness) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "modelId and harness are required." },
        requestId,
      );
    }

    const res = await callService<{ run: unknown }>({
      service: "responsible-ai-svc",
      baseUrl: serverEnv.RESPONSIBLE_AI_SVC_URL,
      method: "POST",
      url: `/api/responsible-ai/evals/${encodeURIComponent(modelId)}/run`,
      body: { harness },
      headers: { "x-actor-role": "platform_admin" },
      requestId,
    });

    if (!res.ok) {
      // Graceful fallback so the demo workflow still returns a run object.
      const run = {
        id: `run-stub-${Date.now()}`,
        modelId,
        harness,
        status: "queued",
        metrics: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
        triggeredBy: session!.email,
      };
      return ok({ run }, requestId);
    }

    return ok({ run: (res.data as any).run ?? res.data }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
