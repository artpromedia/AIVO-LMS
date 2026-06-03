import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession } from "@/lib/bff/guards";
import { callService } from "@/lib/services/client";
import { serverEnv } from "@/lib/env";
import { IMPERSONATION_COOKIE } from "@/lib/impersonation/state";

export const dynamic = "force-dynamic";

/** POST — stop the active Secure Impersonation session. */
export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;

    // Best-effort upstream stop. We clear the cookie regardless so the UI
    // always exits View-As, even if identity-svc is unreachable.
    const res = await callService({
      service: "identity-svc",
      baseUrl: serverEnv.IDENTITY_SVC_URL,
      url: "/api/impersonation/stop",
      method: "POST",
      body: {},
      headers: {
        "x-actor-id": session!.userId,
        "x-actor-role": session!.role,
      },
      requestId,
    });

    const okRes = ok({ stopped: true, stub: !res.ok }, requestId);
    okRes.cookies.set({
      name: IMPERSONATION_COOKIE,
      value: "",
      maxAge: 0,
      path: "/",
    });
    return okRes;
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
