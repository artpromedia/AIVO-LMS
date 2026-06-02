/**
 * Sprint 8 — class CRUD.
 *
 *   GET    /api/bff/admin/school/classes
 *   POST   /api/bff/admin/school/classes          (create)
 *   DELETE /api/bff/admin/school/classes?id=...   (delete)
 *
 * Updates go to the per-id route at .../classes/[classId].
 */
import { NextResponse } from "next/server";
import { failFromUnknown, fail, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ADMIN_ROLES, adminScopeForSession } from "@/lib/bff/admin-scope";
import { createClassroom, deleteClassroom, listClassrooms } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    const scope = adminScopeForSession(session!);
    const tenantId = scope.tenantIds[0];
    if (!tenantId) return ok({ classes: [] }, requestId);
    return ok({ classes: listClassrooms({ tenantId }) }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

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
      schoolId?: string;
      name?: string;
      gradeBand?: string;
      teacherUserId?: string;
      courseId?: string | null;
    } | null;
    if (!body?.schoolId || !body.name || !body.gradeBand || !body.teacherUserId) {
      return fail(
        {
          code: "validation_error",
          message: "schoolId, name, gradeBand, teacherUserId are required",
          userMessage: "Please complete every field before creating the class.",
          status: 400,
        },
        requestId,
      );
    }
    const cls = createClassroom({
      tenantId,
      schoolId: body.schoolId,
      name: body.name,
      gradeBand: body.gradeBand as never,
      teacherUserId: body.teacherUserId,
      courseId: body.courseId ?? null,
    });
    return ok({ classroom: cls }, requestId, { status: 201 });
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
          userMessage: "Class id is required.",
          status: 400,
        },
        requestId,
      );
    const removed = await deleteClassroom(id, tenantId);
    if (!removed)
      return fail(
        {
          code: "not_found",
          message: "Classroom not found",
          userMessage: "That class is not in this school.",
          status: 404,
        },
        requestId,
      );
    return ok({ deleted: true }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
