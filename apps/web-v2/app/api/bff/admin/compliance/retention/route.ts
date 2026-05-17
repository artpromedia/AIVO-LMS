import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { listRetentionPolicies, updateRetentionPolicy } from "@/lib/db/repos";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  id: z.string().min(1).max(64),
  retentionDays: z.number().int().min(0).max(365 * 100).optional(),
  archiveDays: z.number().int().min(0).max(365 * 100).optional(),
  description: z.string().max(1000).optional(),
});

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;
    return ok({ policies: listRetentionPolicies() }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function PATCH(req: Request): Promise<NextResponse> {
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
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid request body.",
        },
        requestId,
      );
    }
    const updated = updateRetentionPolicy(
      parsed.data.id,
      {
        retentionDays: parsed.data.retentionDays,
        archiveDays: parsed.data.archiveDays,
        description: parsed.data.description,
      },
      session!.userId,
    );
    if (!updated) return fail({ ...ERRORS.NOT_FOUND, message: "Policy not found." }, requestId);
    audit(session!, "compliance.retention.updated", requestId, {
      metadata: {
        policyId: updated.id,
        classification: updated.classification,
        retentionDays: updated.retentionDays,
      },
    });
    return ok({ policy: updated }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
