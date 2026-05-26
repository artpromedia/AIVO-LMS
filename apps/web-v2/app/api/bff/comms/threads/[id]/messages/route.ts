/**
 * Sprint 13 — BFF wrapper for comms-svc /api/comms/threads/:id/messages.
 *
 * Forwards GET (list) and POST (author). Boundary visibility is
 * enforced upstream; the BFF only injects the tenant header and maps
 * upstream 403/4xx to BFF error envelopes.
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
  threadId: string,
  init: { method: string; body?: string },
): Promise<Response | NextResponse> {
  const { session, response } = await requireSession(req, requestId);
  if (response) return response;
  if (!["parent", "teacher", "learner", "therapist", "caregiver"].includes(session!.role)) {
    return fail(
      { ...ERRORS.FORBIDDEN_ROLE, message: `Role ${session!.role} cannot access messaging` },
      requestId,
    );
  }
  const url = new URL(req.url);
  const upstream = new URL(
    `${COMMS_SVC_URL}/api/comms/threads/${encodeURIComponent(threadId)}/messages${url.search}`,
  );
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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { id } = await params;
    const upstream = await forward(req, requestId, id, { method: "GET" });
    if (!(upstream instanceof Response)) return upstream as NextResponse;
    if (upstream.status === 403) {
      return fail({ ...ERRORS.FORBIDDEN_LEARNER, message: "Boundary policy denied" }, requestId);
    }
    if (upstream.status === 404) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Thread not found" }, requestId);
    }
    if (!upstream.ok) {
      return fail(
        { ...ERRORS.UPSTREAM_UNAVAILABLE, message: `comms-svc ${upstream.status}` },
        requestId,
      );
    }
    const data = await upstream.json();
    return ok(data, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { id } = await params;
    const body = await req.text();
    const upstream = await forward(req, requestId, id, { method: "POST", body });
    if (!(upstream instanceof Response)) return upstream as NextResponse;
    if (upstream.status === 403) {
      return fail({ ...ERRORS.FORBIDDEN_LEARNER, message: "Boundary policy denied" }, requestId);
    }
    if (upstream.status === 404) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Thread not found" }, requestId);
    }
    if (!upstream.ok) {
      return fail(
        { ...ERRORS.UPSTREAM_UNAVAILABLE, message: `comms-svc ${upstream.status}` },
        requestId,
      );
    }
    const data = await upstream.json();
    return ok(data, requestId, { status: 201 });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
