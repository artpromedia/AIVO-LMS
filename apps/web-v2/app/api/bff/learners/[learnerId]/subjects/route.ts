import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { getSubjectDetail, listSubjects } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(
      session!,
      ["parent", "learner", "teacher", "school_admin"],
      requestId,
    );
    if (roleErr) return roleErr;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection"],
      requestId,
    );
    if (consentErr) return consentErr;

    const subjects = listSubjects().map((s) => {
      const detail = getSubjectDetail(learnerId, session!.tenantId, s.id);
      return {
        subject: s,
        currentLevel: detail?.currentLevel ?? "not_started",
        nextSkillId: detail?.nextSkillId ?? null,
        skillCount: detail?.skills.length ?? 0,
        recommendedTutorPersona: detail?.recommendedTutorPersona ?? null,
      };
    });
    return ok({ subjects }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
