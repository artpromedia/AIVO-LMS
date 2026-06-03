import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { serverEnv } from "@/lib/env";
import { REPORTS_ROLES, reportsAuthHeaders } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...REPORTS_ROLES], requestId);
    if (roleErr) return roleErr;

    const { runId } = await params;
    // Stream raw bytes: callService parses JSON, so fetch directly here to
    // preserve content-type / content-disposition for the file download.
    const base = serverEnv.REPORTS_SVC_URL.replace(/\/$/, "");
    const upstream = await fetch(
      `${base}/api/reports/runs/${encodeURIComponent(runId)}/download`,
      {
        headers: {
          accept: "application/octet-stream",
          ...reportsAuthHeaders(session!),
          "x-request-id": requestId,
        },
      },
    );
    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
        "content-disposition": upstream.headers.get("content-disposition") ?? "attachment",
        "x-request-id": requestId,
      },
    });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
