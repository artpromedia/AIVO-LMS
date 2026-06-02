import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { updateRoster } from "@/lib/admin/school-ops";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

const bodySchema = z.object({
  addLearnerIds: z.array(z.string()).optional(),
  removeLearnerIds: z.array(z.string()).optional(),
  addCoTeacherIds: z.array(z.string()).optional(),
  removeCoTeacherIds: z.array(z.string()).optional(),
});

export async function POST(
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

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid body.",
        },
        requestId,
      );
    }

    const classroom = updateRoster(id, parsed.data);
    if (!classroom) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Classroom not found." }, requestId);
    }

    audit(session!, "school.classroom.roster_update", requestId, {
      metadata: {
        classroomId: id,
        addedLearners: String((parsed.data.addLearnerIds ?? []).length),
        removedLearners: String((parsed.data.removeLearnerIds ?? []).length),
      },
    });

    return ok({ classroom }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
