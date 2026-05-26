/**
 * Sprint 8 — school report BFF.
 *
 *   GET  /api/bff/admin/school/report?startIso=...&endIso=...
 *   GET  /api/bff/admin/school/report?format=csv
 *
 * JSON is the default. ?format=csv returns RFC 4180 CSV with a
 * Content-Disposition header so a browser link triggers the download.
 */
import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ADMIN_ROLES, adminScopeForSession } from "@/lib/bff/admin-scope";
import { getSchoolReport, renderSchoolReportCsv } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    const scope = adminScopeForSession(session!);
    const tenantId = scope.tenantIds[0];
    if (!tenantId) return ok({ report: null }, requestId);

    const url = new URL(req.url);
    const startIso = url.searchParams.get("startIso") ?? undefined;
    const endIso = url.searchParams.get("endIso") ?? undefined;
    const format = url.searchParams.get("format");

    const report = getSchoolReport(tenantId, { startIso, endIso });
    if (format === "csv") {
      const csv = renderSchoolReportCsv(report);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="school-report-${tenantId}.csv"`,
          "x-request-id": requestId,
        },
      });
    }
    return ok({ report }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
