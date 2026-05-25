import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * GET /api/bff/curriculum/districts/search?q=…&state=…
 *
 * Backs the "Not your district? Search…" override on the
 * `<ZipDistrictField>`. Proxies through to identity-svc.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const state = url.searchParams.get("state") ?? undefined;

  if (q.length < 2) {
    return ok({ matches: [] }, requestId);
  }

  try {
    const params = new URLSearchParams({ q });
    if (state) params.set("state", state);
    const res = await fetch(
      `${serverEnv.IDENTITY_SVC_URL}/api/curriculum/districts/search?${params.toString()}`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) {
      return fail(
        {
          code: "identity_svc_error",
          message: `identity-svc returned ${res.status}`,
          userMessage: "District search is unavailable right now.",
          retryable: true,
          status: 502,
        },
        requestId,
      );
    }
    const json = await res.json();
    return ok(json, requestId);
  } catch (err) {
    return failFromUnknown(err, requestId);
  }
}
