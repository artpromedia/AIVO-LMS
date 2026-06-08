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

    // No fabricated fallback. Impersonation is security-sensitive: a "View-As"
    // session MUST be minted by identity-svc (which enforces step-up / MFA and
    // authorization). If the upstream is unreachable or refuses (e.g. 403
    // STEP_UP_REQUIRED), surface a typed error — never synthesize a local
    // "imp-local-…" session that bypasses those checks.
    if (!res.ok) {
      return fail(
        {
          code: res.status === 403 ? "step_up_required" : "upstream_unavailable",
          message: `identity-svc rejected impersonation start (status ${res.status ?? "n/a"}).`,
          userMessage:
            res.status === 403
              ? "Additional verification is required to start View-As."
              : "Could not start View-As — the identity service is unavailable.",
          status: res.status === 403 ? 403 : 502,
        },
        requestId,
      );
    }

    const upstream = res.data.session;
    if (!upstream?.id) {
      return fail(
        {
          code: "upstream_unavailable",
          message: "identity-svc accepted the request but returned no impersonation session.",
          userMessage: "Could not start View-As — the identity service returned an invalid session.",
          status: 502,
        },
        requestId,
      );
    }
    const endsAt = upstream.endsAt ?? new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const cookieValue = JSON.stringify({
      sessionId: upstream.id,
      subjectId: upstream.subjectId ?? body.subject_user_id,
      subjectName: upstream.subjectName ?? body.subject_user_id,
      subjectRole: upstream.subjectRole ?? "user",
      endsAt,
      allowWrites: upstream.allowWrites ?? allowWrites,
      reason: upstream.reason ?? body.reason,
    });

    const okRes = ok(
      {
        started: true,
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
