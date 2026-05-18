import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { listMigrationJobs, runMigrationJob } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;
    return ok({ jobs: listMigrationJobs() }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

const postSchema = z.object({
  source: z.string().min(1).max(120),
  kind: z.enum(["users", "learners", "iep_documents", "lesson_runs"]),
  dryRun: z.boolean().default(true),
  sourceRecords: z
    .array(z.object({ sourceId: z.string().min(1), payload: z.record(z.string(), z.unknown()) }))
    .min(1)
    .max(1000),
});

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
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid body.",
        },
        requestId,
      );
    }
    const job = runMigrationJob({ ...parsed.data, createdByUserId: session!.userId });
    audit(session!, "migration.job.run", requestId, {
      metadata: {
        jobId: job.id,
        kind: job.kind,
        dryRun: job.dryRun ? "1" : "0",
        success: String(job.successRecords),
        failed: String(job.failedRecords),
      },
    });
    return ok({ job }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
