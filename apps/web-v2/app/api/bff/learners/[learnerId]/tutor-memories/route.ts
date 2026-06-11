/**
 * Wave E (S12) — parent visibility into tutor memory.
 *
 * GET → { enabled: boolean, memories: TutorMemoryView[] }
 *
 * Every episodic memory the agent keeps is listed here, with kind, text,
 * and expiry — nothing the tutor remembers is hidden from the parent.
 * `enabled: false` (flag off / live path unconfigured) returns an empty
 * list so the card renders its calm empty state.
 */
import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { tutorAgenticModeEnabled } from "@/lib/feature-flags";
import { isLiveTutorAgent, tutorAgentListMemories } from "@/lib/bff/tutor-agent";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "teacher"], requestId);
    if (roleErr) return roleErr;
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;

    if (!(await tutorAgenticModeEnabled()) || !isLiveTutorAgent()) {
      return ok({ enabled: false, memories: [] }, requestId);
    }
    try {
      const memories = await tutorAgentListMemories(learnerId);
      return ok({ enabled: true, memories }, requestId);
    } catch (err) {
      logger.warn(
        {
          feature: "tutor-agent",
          learnerId,
          err: err instanceof Error ? err.message : String(err),
        },
        "[tutor-agent] memory list failed",
      );
      return ok({ enabled: true, memories: [], degraded: true }, requestId);
    }
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
