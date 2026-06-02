import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { listClassroomsFor, createClassroom, type GradeBand } from "@/lib/admin/school-ops";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

const VALID_GRADES: GradeBand[] = [
  "K",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
];

const createSchema = z.object({
  schoolId: z.string().min(1),
  name: z.string().min(1).max(200),
  grade: z.enum(["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as [
    GradeBand,
    ...GradeBand[],
  ]),
  teacherId: z.string().min(1),
});

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    const url = new URL(req.url);
    const schoolId = url.searchParams.get("schoolId") ?? session!.tenantId ?? "";
    const grade = url.searchParams.get("grade") as GradeBand | null;
    const teacherId = url.searchParams.get("teacherId") ?? undefined;

    const classrooms = listClassroomsFor(schoolId, {
      grade: grade && (VALID_GRADES as string[]).includes(grade) ? grade : undefined,
      teacherId,
    });

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

    const classroom = createClassroom(parsed.data);
    audit(session!, "school.classroom.create", requestId, {
      metadata: { classroomId: classroom.id, schoolId: parsed.data.schoolId },
    });

    return ok({ classroom }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
