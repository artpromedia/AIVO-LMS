import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { createClassroom, getSchool, listClassrooms } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

const createSchema = z.object({
  schoolId: z.string().min(1),
  name: z.string().min(1).max(120),
  gradeBand: z.enum(["K-2", "3-5", "6-8", "9-12"]),
  teacherUserId: z.string().min(1),
  courseId: z.string().min(1).nullable().optional(),
});

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    const url = new URL(req.url);
    const schoolId = url.searchParams.get("schoolId") ?? undefined;
    const classrooms = listClassrooms({ tenantId: session!.tenantId, schoolId });
    return ok({ classrooms }, requestId);
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
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid body.",
        },
        requestId,
      );
    }
    const school = getSchool(parsed.data.schoolId);
    if (!school) {
      return fail({ ...ERRORS.NOT_FOUND, message: "School not found." }, requestId);
    }
    if (school.tenantId !== session!.tenantId && session!.role !== "platform_admin") {
      return fail(
        { ...ERRORS.FORBIDDEN_TENANT, message: "School belongs to another tenant." },
        requestId,
      );
    }
    const rec = createClassroom({
      tenantId: school.tenantId,
      schoolId: parsed.data.schoolId,
      name: parsed.data.name,
      gradeBand: parsed.data.gradeBand,
      teacherUserId: parsed.data.teacherUserId,
      courseId: parsed.data.courseId ?? null,
    });
    audit(session!, "rostering.classroom.created", requestId, {
      metadata: { id: rec.id, schoolId: rec.schoolId },
    });
    return ok({ classroom: rec }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
