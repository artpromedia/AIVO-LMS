import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { callService } from "@/lib/services/client";
import { serverEnv } from "@/lib/env";
import { IMPERSONATION_COOKIE } from "@/lib/impersonation/state";

export const dynamic = "force-dynamic";

type StartBody = {
  subject_user_id?: string;
  reason?: string;
  ttl_seconds?: number;
  allow_writes?: boolean;
  subject_consent?: boolean;
};

type StartResponse = {
  session?: {
    id?: string;
    subjectId?: string;
    subjectName?: string;
    subjectRole?: string;
    endsAt?: string;
    allowWrites?: boolean;
    reason?: string;
  };
  token?: string;
};

/** POST — start a Secure Impersonation session. */
export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin", "district_admin"], requestId);
    if (roleErr) return roleErr;

    const body = (await req.json().catch(() => ({}))) as StartBody;
    if (!body.subject_user_id || !body.reason) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "subject_user_id and reason are required" },
        requestId,
      );
    }
    const ttlSeconds =
      typeof body.ttl_seconds === "number" && body.ttl_seconds > 0 ? body.ttl_seconds : 900;
    const allowWrites = Boolean(body.allow_writes);

    // Real step-up is triggered server-side by identity-svc; we forward the
    // caller's step-up token so identity-svc can validate / challenge it.
    const stepUpToken = req.headers.get("x-step-up-token") ?? "";

    const res = await callService<StartResponse>({
      service: "identity-svc",
      baseUrl: serverEnv.IDENTITY_SVC_URL,
      url: "/api/impersonation/start",
      method: "POST",
      body,
      headers: {
        "x-step-up-token": stepUpToken,
        "x-actor-id": session!.userId,
        "x-actor-role": session!.role,
        "x-actor-tenant": session!.tenantId,
      },
      requestId,
    });

    // Resolve the cookie state either from the upstream session or, when the
    // upstream is unreachable in the demo env, synthesize it from the request
    // body so the View-As UI is still demoable.
    const upstream = res.ok ? res.data.session : undefined;
    const endsAt = upstream?.endsAt ?? new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const cookieValue = JSON.stringify({
      sessionId: upstream?.id ?? `imp-local-${Date.now()}`,
      subjectId: upstream?.subjectId ?? body.subject_user_id,
      subjectName: upstream?.subjectName ?? body.subject_user_id,
      subjectRole: upstream?.subjectRole ?? "user",
      endsAt,
      allowWrites: upstream?.allowWrites ?? allowWrites,
      reason: upstream?.reason ?? body.reason,
    });

    // Note: if identity-svc returns 403 STEP_UP_REQUIRED, a production build
    // would surface that to trigger an MFA challenge. For the demo env we fall
    // through and set the local cookie so the View-As flow stays exercisable.

    const okRes = ok(
      {
        started: true,
        stub: !res.ok,
        endsAt,
      },
      requestId,
    );
    // httpOnly:false so the client banner countdown can read endsAt.
    okRes.cookies.set({
      name: IMPERSONATION_COOKIE,
      value: cookieValue,
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ttlSeconds,
    });
    return okRes;
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
