import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { listCurriculumImportJobs, startCurriculumImportJob } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

const FRAMEWORK_SLUGS = [
  "common-core-math",
  "common-core-ela",
  "ngss-science",
  "state-placeholder",
  "aivo-extensions",
] as const;

const bodySchema = z.object({
  frameworkSlug: z.enum(FRAMEWORK_SLUGS),
  source: z.string().min(1).max(500),
});

const IMPORT_READ_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    // Read is open to all admin roles for visibility into catalog history.
    // Mutations (POST below) remain platform_admin-only.
    const roleErr = requireRole(session!, [...IMPORT_READ_ROLES], requestId);
    if (roleErr) return roleErr;
    return ok({ jobs: listCurriculumImportJobs() }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
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
    const job = startCurriculumImportJob({
      frameworkSlug: parsed.data.frameworkSlug,
      source: parsed.data.source,
      requestedByUserId: session!.userId,
    });
    audit(session!, "curriculum.import.started", requestId, {
      metadata: { jobId: job.id, frameworkSlug: job.frameworkSlug, status: job.status },
    });
    return ok({ job }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
