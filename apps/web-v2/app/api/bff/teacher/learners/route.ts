import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { listLearnersForTeacher } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

/** GET /api/bff/teacher/learners — roster scoped to the teacher's tenant. */
export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["teacher"], requestId);
    if (roleErr) return roleErr;
    const learners = await listLearnersForTeacher(session!.userId, session!.tenantId);
    return ok(
      {
        learners: learners.map((l) => ({
          id: l.id,
          displayName: l.displayName,
          birthYear: l.birthYear,
          readinessState: l.readinessState,
          functioningLevel: l.functioningLevel,
        })),
      },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
