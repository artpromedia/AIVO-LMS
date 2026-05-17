import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import {
  deleteTeacherAssignment,
  getLearner,
  getTeacherAssignment,
  updateTeacherAssignment,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ assignmentId: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { assignmentId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["teacher"], requestId);
    if (roleErr) return roleErr;
    const a = getTeacherAssignment(assignmentId, session!.userId, session!.tenantId);
    if (!a)
      return fail({ ...ERRORS.NOT_FOUND, message: "Assignment not found." }, requestId);
    return ok({ assignment: a }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { assignmentId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["teacher"], requestId);
    if (roleErr) return roleErr;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: Parameters<typeof updateTeacherAssignment>[3] = {};
    if (typeof body.title === "string") patch.title = body.title.trim();
    if (typeof body.instructions === "string")
      patch.instructions = body.instructions.trim();
    if (Array.isArray(body.skillIds) && body.skillIds.every((s) => typeof s === "string"))
      patch.skillIds = body.skillIds as string[];
    if (
      Array.isArray(body.learnerIds) &&
      body.learnerIds.every((s) => typeof s === "string")
    ) {
      const ids = body.learnerIds as string[];
      const foreignIds = ids.filter((id) => !getLearner(id, session!.tenantId));
      if (foreignIds.length > 0) {
        return fail(
          {
            ...ERRORS.VALIDATION_FAILED,
            message: `One or more learners are not in your roster: ${foreignIds.join(", ")}`,
          },
          requestId,
        );
      }
      patch.learnerIds = ids;
    }
    if (typeof body.dueAt === "string" || body.dueAt === null)
      patch.dueAt = body.dueAt as string | null;
    if (body.status === "active" || body.status === "archived")
      patch.status = body.status;
    const updated = updateTeacherAssignment(
      assignmentId,
      session!.userId,
      session!.tenantId,
      patch,
    );
    if (!updated)
      return fail({ ...ERRORS.NOT_FOUND, message: "Assignment not found." }, requestId);
    audit(session!, "teacher.assignment.update", requestId, {
      metadata: { assignmentId },
    });
    return ok({ assignment: updated }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function DELETE(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { assignmentId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["teacher"], requestId);
    if (roleErr) return roleErr;
    const removed = deleteTeacherAssignment(
      assignmentId,
      session!.userId,
      session!.tenantId,
    );
    if (!removed)
      return fail({ ...ERRORS.NOT_FOUND, message: "Assignment not found." }, requestId);
    audit(session!, "teacher.assignment.delete", requestId, {
      metadata: { assignmentId },
    });
    return ok({ deleted: true }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
