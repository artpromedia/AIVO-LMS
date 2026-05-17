import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { getSchool, runRosterImport } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  schoolId: z.string().min(1),
  source: z.enum(["csv", "oneroster_v1p1", "oneroster_v1p2", "clever", "classlink"]),
  csvText: z.string().min(1).max(2 * 1024 * 1024), // 2 MB cap on the raw text
  dryRun: z.boolean().default(false),
});

const ADMIN_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

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
        { ...ERRORS.VALIDATION_FAILED, message: parsed.error.issues[0]?.message ?? "Invalid body." },
        requestId,
      );
    }
    const school = getSchool(parsed.data.schoolId);
    if (!school) {
      return fail({ ...ERRORS.NOT_FOUND, message: "School not found." }, requestId);
    }
    if (school.tenantId !== session!.tenantId && session!.role !== "platform_admin") {
      return fail(
        { ...ERRORS.FORBIDDEN_TENANT, message: "School belongs to another tenant." },
        requestId,
      );
    }
    const job = runRosterImport({
      tenantId: school.tenantId,
      schoolId: parsed.data.schoolId,
      source: parsed.data.source,
      csvText: parsed.data.csvText,
      dryRun: parsed.data.dryRun,
      createdByUserId: session!.userId,
    });
    audit(session!, "rostering.import", requestId, {
      metadata: {
        jobId: job.id,
        schoolId: parsed.data.schoolId,
        dryRun: parsed.data.dryRun ? "1" : "0",
        created: String(job.createdRows),
        errors: String(job.errorRows),
      },
    });
    return ok({ job }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
