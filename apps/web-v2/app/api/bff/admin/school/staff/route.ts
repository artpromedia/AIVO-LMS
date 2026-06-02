/**
 * Sprint 8 — staff add / remove.
 *
 *   POST   /api/bff/admin/school/staff
 *   DELETE /api/bff/admin/school/staff?id=...
 *
 * Listing already lives at the existing /api/bff/admin/users surface;
 * this route fills in the create + revoke half so the /admin/school
 * /staff page can complete invites and remove access.
 */
import { NextResponse } from "next/server";
import { failFromUnknown, fail, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ADMIN_ROLES, adminScopeForSession } from "@/lib/bff/admin-scope";
import { addStaffUser, removeStaffUser } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["TEACHER", "SCHOOL_ADMIN", "THERAPIST", "CAREGIVER"]);

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    const scope = adminScopeForSession(session!);
    const tenantId = scope.tenantIds[0];
    if (!tenantId)
      return fail(
        {
          code: "no_tenant",
          message: "No tenant in scope",
          userMessage: "Your session has no school in scope.",
          status: 403,
        },
        requestId,
      );

    const body = (await req.json().catch(() => null)) as {
      email?: string;
      displayName?: string;
      role?: string;
    } | null;
    if (!body?.email || !body.displayName || !body.role) {
      return fail(
        {
          code: "validation_error",
          message: "email, displayName, role are required",
          userMessage: "Please fill in name, email, and role.",
          status: 400,
        },
        requestId,
      );
    }
    if (!ALLOWED_ROLES.has(body.role)) {
      return fail(
        {
          code: "validation_error",
          message: `role must be one of ${[...ALLOWED_ROLES].join(", ")}`,
          userMessage: "Choose a valid staff role.",
          status: 400,
        },
        requestId,
      );
    }
    const user = await addStaffUser({
      tenantId,
      email: body.email,
      displayName: body.displayName,
      role: body.role as never,
    });
    return ok({ user }, requestId, { status: 201 });
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
    const scope = adminScopeForSession(session!);
    const tenantId = scope.tenantIds[0];
    if (!tenantId)
      return fail(
        {
          code: "no_tenant",
          message: "No tenant in scope",
          userMessage: "Your session has no school in scope.",
          status: 403,
        },
        requestId,
      );

    const id = new URL(req.url).searchParams.get("id");
    if (!id)
      return fail(
        {
          code: "validation_error",
          message: "id is required",
          userMessage: "User id is required.",
          status: 400,
        },
        requestId,
      );
    const removed = await removeStaffUser(id, tenantId);
    if (!removed)
      return fail(
        {
          code: "not_found",
          message: "Staff user not found",
          userMessage: "That staff member is no longer on the roster.",
          status: 404,
        },
        requestId,
      );
    return ok({ deleted: true }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
