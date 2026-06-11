/**
 * Wave E (S12) — parent delete of a single tutor memory.
 *
 * DELETE → { deleted: boolean }
 *
 * The parent's delete is final: the row is removed from tutor-svc, so it
 * can never ride into another session's context. Audited.
 */
import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { tutorAgenticModeEnabled } from "@/lib/feature-flags";
import { isLiveTutorAgent, tutorAgentDeleteMemory } from "@/lib/bff/tutor-agent";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string; memoryId: string }> };

export async function DELETE(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId, memoryId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;

    if (!(await tutorAgenticModeEnabled()) || !isLiveTutorAgent()) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Memory not found" }, requestId);
    }
    const deleted = await tutorAgentDeleteMemory(learnerId, memoryId);
    if (!deleted) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Memory not found" }, requestId);
    }
    audit(session!, "tutor_agent.memory_deleted", requestId, {
      learnerId,
      metadata: { memoryId },
    });
    return ok({ deleted: true }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
