import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { createTeacherAssignment, getLearner, listTeacherAssignments } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

/** GET — list this teacher's assignments. */
export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["teacher"], requestId);
    if (roleErr) return roleErr;
    const assignments = listTeacherAssignments(session!.userId, session!.tenantId);
    return ok({ assignments }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

/** POST — create a new assignment. */
export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["teacher"], requestId);
    if (roleErr) return roleErr;

    const body = (await req.json().catch(() => ({}))) as {
      title?: unknown;
      instructions?: unknown;
      subjectId?: unknown;
      skillIds?: unknown;
      learnerIds?: unknown;
      dueAt?: unknown;
    };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const instructions = typeof body.instructions === "string" ? body.instructions.trim() : "";
    const subjectId = typeof body.subjectId === "string" ? body.subjectId : "";
    const skillIds =
      Array.isArray(body.skillIds) && body.skillIds.every((s) => typeof s === "string")
        ? (body.skillIds as string[])
        : null;
    const learnerIds =
      Array.isArray(body.learnerIds) && body.learnerIds.every((s) => typeof s === "string")
        ? (body.learnerIds as string[])
        : null;
    const dueAt = typeof body.dueAt === "string" && body.dueAt.length > 0 ? body.dueAt : null;
    if (
      !title ||
      title.length > 200 ||
      !subjectId ||
      !skillIds ||
      skillIds.length === 0 ||
      !learnerIds ||
      learnerIds.length === 0
    ) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: "title, subjectId, skillIds[], and learnerIds[] are required.",
        },
        requestId,
      );
    }
    // Explicit cross-tenant guard at the BFF layer (defense-in-depth alongside
    // the repo-layer filter). Any learnerId belonging to another tenant — or
    // not existing at all — fails the whole request rather than being silently
    // dropped. This prevents a teacher from partially-leaking which learner
    // IDs do/don't exist in their tenant and ensures the assignment they
    // think they created actually includes the learners they specified.
    const foreignIds = learnerIds.filter((id) => !getLearner(id, session!.tenantId));
    if (foreignIds.length > 0) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: `One or more learners are not in your roster: ${foreignIds.join(", ")}`,
        },
        requestId,
      );
    }
    const created = createTeacherAssignment({
      teacherId: session!.userId,
      tenantId: session!.tenantId,
      title,
      instructions,
      subjectId,
      skillIds,
      learnerIds,
      dueAt,
    });
    if (created.learnerIds.length === 0) {
      // All learnerIds were filtered out — they didn't belong to this tenant.
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: "No valid learners in this tenant.",
        },
        requestId,
      );
    }
    audit(session!, "teacher.assignment.create", requestId, {
      metadata: {
        assignmentId: created.id,
        learnerCount: created.learnerIds.length,
      },
    });
    return ok({ assignment: created }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
