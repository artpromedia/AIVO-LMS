/**
 * Sprint 13 — BFF wrapper for comms-svc /api/comms/threads.
 *
 * Adds the active-tenant header before forwarding to comms-svc and
 * surfaces the upstream 403 (boundary policy) as-is. The policy itself
 * is enforced upstream — the BFF only adds context headers.
 */
import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok, fail } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession } from "@/lib/bff/guards";

export const dynamic = "force-dynamic";

const COMMS_SVC_URL = process.env.COMMS_SVC_URL ?? "http://localhost:3010";

async function forward(
  req: Request,
  requestId: string,
  init: { method: string; body?: string },
): Promise<Response> {
  const { session, response } = await requireSession(req, requestId);
  if (response) return response;
  if (!["parent", "teacher", "learner", "therapist", "caregiver"].includes(session!.role)) {
    return fail(
      { ...ERRORS.FORBIDDEN_ROLE, message: `Role ${session!.role} cannot access messaging` },
      requestId,
    );
  }
  const url = new URL(req.url);
  const upstream = new URL(`${COMMS_SVC_URL}/api/comms/threads${url.search}`);
  return fetch(upstream.toString(), {
    method: init.method,
    headers: {
      "content-type": "application/json",
      authorization: req.headers.get("authorization") ?? "",
      "x-active-tenant": session!.tenantId,
      "x-actor-user-id": session!.userId,
      "x-actor-role": session!.role,
      "x-request-id": requestId,
    },
    body: init.body,
  });
}

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const upstream = await forward(req, requestId, { method: "GET" });
    if (!(upstream instanceof Response)) return upstream as NextResponse;
    if (upstream.status === 403) {
      return fail({ ...ERRORS.FORBIDDEN_LEARNER, message: "Boundary policy denied" }, requestId);
    }
    if (!upstream.ok) {
      return fail({ ...ERRORS.UPSTREAM_UNAVAILABLE, message: `comms-svc ${upstream.status}` }, requestId);
    }
    const data = await upstream.json();
    return ok(data, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const body = await req.text();
    const upstream = await forward(req, requestId, { method: "POST", body });
    if (!(upstream instanceof Response)) return upstream as NextResponse;
    if (upstream.status === 403) {
      return fail({ ...ERRORS.FORBIDDEN_LEARNER, message: "Boundary policy denied" }, requestId);
    }
    if (!upstream.ok) {
      return fail({ ...ERRORS.UPSTREAM_UNAVAILABLE, message: `comms-svc ${upstream.status}` }, requestId);
    }
    const data = await upstream.json();
    return ok(data, requestId, { status: 201 });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
