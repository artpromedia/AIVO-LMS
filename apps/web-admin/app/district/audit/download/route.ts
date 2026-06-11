/**
 * District audit export download (Sprint B4) — streams identity-svc's
 * tenant-scoped, self-auditing export (CSV or NDJSON) to the browser.
 * When the deployment enforces step-up auth for data exports, the 403 is
 * surfaced as-is so the console can explain what is required instead of
 * pretending the file was empty.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePageRole } from "@aivo/admin-auth";
import { fetchDistrictActivityExport } from "@/lib/district-activity";

export async function GET(request: NextRequest): Promise<Response> {
  const session = await requirePageRole(["district_admin", "platform_admin"]);
  const params = request.nextUrl.searchParams;
  const format = params.get("format") === "json" ? "json" : "csv";
  const upstream = await fetchDistrictActivityExport(session, {
    format,
    action: params.get("action") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  });

  if (!upstream.ok) {
    const body = await upstream.text();
    let message = "Export failed.";
    try {
      const parsed = JSON.parse(body) as { code?: string; error?: string };
      message =
        parsed.code === "STEP_UP_REQUIRED"
          ? "This deployment requires step-up re-authentication for data exports. Sign in again and retry."
          : (parsed.error ?? message);
    } catch {
      // non-JSON upstream error: keep the generic message
    }
    return NextResponse.json({ error: message }, { status: upstream.status });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ??
        (format === "json" ? "application/x-ndjson; charset=utf-8" : "text/csv; charset=utf-8"),
      "content-disposition":
        upstream.headers.get("content-disposition") ??
        `attachment; filename="district-audit.${format === "json" ? "ndjson" : "csv"}"`,
      "cache-control": "no-store",
    },
  });
}
