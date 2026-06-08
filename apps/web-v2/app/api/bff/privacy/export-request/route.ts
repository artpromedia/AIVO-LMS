import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { createDataExportRequest, listDataExportRequestsForUser } from "@/lib/db/repos";
import { enterpriseFlags } from "@/lib/bff/feature-flags";
import { requestParentExport } from "@/lib/bff/service-clients/data-governance";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  learnerId: z.string().min(1).max(64).nullable().optional(),
  notes: z.string().max(2000).optional(),
});

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const items = await listDataExportRequestsForUser(session!.userId, session!.tenantId);
    return ok({ requests: items }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
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
          message: parsed.error.issues[0]?.message ?? "Invalid request body.",
        },
        requestId,
      );
    }
    const learnerId = parsed.data.learnerId ?? null;
    if (learnerId) {
      const scope = await requireLearnerScope(session!, learnerId, requestId);
      if (scope) return scope;
    }
    const rec = await createDataExportRequest({
      tenantId: session!.tenantId,
      parentUserId: session!.userId,
      learnerId,
      notes: parsed.data.notes ?? null,
    });

    // Sprint G: when the data-governance flag is on AND we have a
    // learner-scoped request, fan out to data-governance-svc which
    // owns the canonical export-builder pipeline. The local record
    // stays in place as the parent-facing receipt; the canonical job
    // id from the service is recorded on it for follow-up.
    if (enterpriseFlags.dataGovernanceCenter() && learnerId) {
      const remote = await requestParentExport({ learnerId });
      if (remote.ok) {
        audit(session!, "privacy.export_request.svc_dispatched", requestId, {
          learnerId,
          metadata: { localId: rec.id, remoteJobId: remote.data.id },
        });
      } else {
        audit(session!, "privacy.export_request.svc_failed", requestId, {
          learnerId,
          metadata: { localId: rec.id, reason: remote.reason },
        });
      }
    }

    audit(session!, "privacy.export_request.created", requestId, {
      learnerId,
      metadata: { requestId: rec.id },
    });
    return ok({ request: rec }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
