import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import {
  getClassroom,
  updateClassroom,
  deleteClassroom,
  type GradeBand,
} from "@/lib/admin/school-ops";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  grade: z
    .enum(["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as [
      GradeBand,
      ...GradeBand[],
    ])
    .optional(),
  teacherId: z.string().min(1).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    const { id } = await params;
    const classroom = getClassroom(id);
    if (!classroom) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Classroom not found." }, requestId);
    }
    return ok({ classroom }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    const { id } = await params;
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
          message: parsed.error.issues[0]?.message ?? "Invalid body.",
        },
        requestId,
      );
    }

    const classroom = updateClassroom(id, parsed.data);
    if (!classroom) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Classroom not found." }, requestId);
    }

    audit(session!, "school.classroom.update", requestId, {
      metadata: { classroomId: id },
    });

    return ok({ classroom }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    const { id } = await params;
    const deleted = deleteClassroom(id);
    if (!deleted) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Classroom not found." }, requestId);
    }

    audit(session!, "school.classroom.delete", requestId, {
      metadata: { classroomId: id },
    });

    return ok({ deleted: true }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
