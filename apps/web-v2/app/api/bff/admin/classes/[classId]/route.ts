import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import {
  getClassroom,
  listEnrollments,
  updateClassroom,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ classId: string }> };

const ADMIN_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  gradeBand: z.enum(["K-2", "3-5", "6-8", "9-12"]).optional(),
  teacherUserId: z.string().min(1).optional(),
  courseId: z.string().min(1).nullable().optional(),
});

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { classId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES, "teacher"], requestId);
    if (roleErr) return roleErr;
    const classroom = getClassroom(classId, session!.tenantId);
    if (!classroom) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Class not found." }, requestId);
    }
    if (session!.role === "teacher" && classroom.teacherUserId !== session!.userId) {
      return fail({ ...ERRORS.FORBIDDEN_ROLE, message: "You do not teach this class." }, requestId);
    }
    return ok({ classroom, enrollments: listEnrollments(classId) }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { classId } = await params;
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
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: parsed.error.issues[0]?.message ?? "Invalid body." },
        requestId,
      );
    }
    const rec = updateClassroom(classId, session!.tenantId, parsed.data);
    if (!rec) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Class not found." }, requestId);
    }
    audit(session!, "rostering.classroom.updated", requestId, { metadata: { id: rec.id } });
    return ok({ classroom: rec }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
