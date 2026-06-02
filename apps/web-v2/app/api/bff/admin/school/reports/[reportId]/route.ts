import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { runReport, reportToCsv, REPORT_CATALOG } from "@/lib/admin/school-ops";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

const bodySchema = z.object({
  schoolId: z.string().min(1),
  params: z.record(z.string()).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ reportId: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    const { reportId } = await params;

    const catalog = REPORT_CATALOG.find((r) => r.id === reportId);
    if (!catalog) {
      return fail({ ...ERRORS.NOT_FOUND, message: `Report "${reportId}" not found.` }, requestId);
    }

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid body.",
        },
        requestId,
      );
    }

    const url = new URL(req.url);
    const format = url.searchParams.get("format");
    const result = runReport(reportId, parsed.data.schoolId, parsed.data.params ?? {});

    if (format === "csv") {
      const csv = reportToCsv(result);
      return new NextResponse(csv, {
        headers: {
          "content-type": "text/csv",
          "content-disposition": `attachment; filename="${reportId}-report.csv"`,
          "x-request-id": requestId,
        },
      });
    }

    return ok({ result }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
