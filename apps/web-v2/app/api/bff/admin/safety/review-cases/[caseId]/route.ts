import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { getHumanReviewCase, updateHumanReviewCase } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ caseId: string }> };

const patchSchema = z.object({
  status: z
    .enum(["open", "in_review", "resolved_allow", "resolved_block", "escalated"])
    .optional(),
  assignedToUserId: z.string().min(1).max(64).nullable().optional(),
  resolution: z.string().min(1).max(2000).nullable().optional(),
});

const ADMIN_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { caseId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    const existing = getHumanReviewCase(caseId);
    if (!existing) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Review case not found." }, requestId);
    }
    if (session!.role !== "platform_admin" && existing.tenantId !== session!.tenantId) {
      return fail(
        { ...ERRORS.FORBIDDEN_TENANT, message: "Review case is not in your tenant." },
        requestId,
      );
    }
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: parsed.error.issues[0]?.message ?? "Invalid body." },
        requestId,
      );
    }
    const isResolution =
      parsed.data.status === "resolved_allow" || parsed.data.status === "resolved_block";
    const updated = updateHumanReviewCase(caseId, {
      status: parsed.data.status,
      assignedToUserId: parsed.data.assignedToUserId,
      resolution: parsed.data.resolution,
      resolvedByUserId: isResolution ? session!.userId : undefined,
    });
    audit(session!, "safety.review.updated", requestId, {
      metadata: { caseId, status: parsed.data.status ?? "" },
    });
    return ok({ case: updated }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
