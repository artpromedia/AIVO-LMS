import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { createImportJob, listImportJobs } from "@/lib/admin/school-ops";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

const bodySchema = z.object({
  schoolId: z.string().min(1),
  csvText: z
    .string()
    .min(1)
    .max(2 * 1024 * 1024),
  mapping: z.record(z.number()).optional(),
  dryRun: z.boolean().default(false),
});

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

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

    const job = createImportJob({
      schoolId: parsed.data.schoolId,
      csvText: parsed.data.csvText,
      dryRun: parsed.data.dryRun,
    });

    audit(session!, "school.import.run", requestId, {
      metadata: {
        jobId: job.id,
        schoolId: parsed.data.schoolId,
        dryRun: String(parsed.data.dryRun),
        totalRows: String(job.validation?.summary.totalRows ?? 0),
        errorRows: String(job.errorRows),
      },
    });

    return ok({ job }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    const url = new URL(req.url);
    const schoolId = url.searchParams.get("schoolId") ?? session!.tenantId ?? "";

    const jobs = listImportJobs(schoolId);
    return ok({ jobs }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
