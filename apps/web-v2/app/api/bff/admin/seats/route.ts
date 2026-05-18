import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { assignSeat, listSeatLicensesForTenant, revokeSeat } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    return ok({ licenses: listSeatLicensesForTenant(session!.tenantId) }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

const assignSchema = z.object({
  licenseId: z.string().min(1),
  subjectId: z.string().min(1),
  subjectKind: z.enum(["learner", "teacher"]),
});
const revokeSchema = z.object({ assignmentId: z.string().min(1) });

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
    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid body.",
        },
        requestId,
      );
    }
    const result = assignSeat({ ...parsed.data, tenantId: session!.tenantId });
    if (!result.ok) {
      const msg =
        result.reason === "full"
          ? "All seats are assigned."
          : result.reason === "already_assigned"
            ? "Seat already assigned."
            : result.reason === "subject_not_in_tenant"
              ? "That learner or teacher isn't in this tenant."
              : "License not found.";
      const err =
        result.reason === "license_not_found"
          ? ERRORS.NOT_FOUND
          : result.reason === "subject_not_in_tenant"
            ? ERRORS.FORBIDDEN_TENANT
            : ERRORS.PRECONDITION_FAILED;
      return fail({ ...err, message: msg }, requestId);
    }
    audit(session!, "billing.seat.assigned", requestId, {
      metadata: { assignmentId: result.assignment.id },
    });
    return ok({ assignment: result.assignment }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function DELETE(req: Request): Promise<NextResponse> {
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
    const parsed = revokeSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid body.",
        },
        requestId,
      );
    }
    const a = revokeSeat(parsed.data.assignmentId, session!.tenantId);
    if (!a) return fail({ ...ERRORS.NOT_FOUND, message: "Assignment not found." }, requestId);
    audit(session!, "billing.seat.revoked", requestId, { metadata: { assignmentId: a.id } });
    return ok({ assignment: a }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
