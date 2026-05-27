import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { audit } from "@/lib/bff/audit";
import {
  getOrCreateParentAssessment,
  refreshLearnerReadiness,
  submitParentAssessment,
} from "@/lib/db/repos";
import {
  ASSESSMENT_SECTION_ORDER,
  validateSection,
  type AssessmentSectionId,
} from "@/lib/validators/parent-assessment";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection"],
      requestId,
    );
    if (consentErr) return consentErr;

    const current = getOrCreateParentAssessment(learnerId, session!.tenantId);
    const missing: AssessmentSectionId[] = [];
    for (const sec of ASSESSMENT_SECTION_ORDER) {
      // `?? {}` keeps optional sections (basics, strengths, background,
      // learning_profile) non-blocking for legacy assessments whose stored
      // answers map predates these keys.
      const v = validateSection(sec, current.answers[sec] ?? {});
      if (!v.ok) missing.push(sec);
    }
    if (missing.length > 0) {
      return fail(
        {
          ...ERRORS.PRECONDITION_FAILED,
          message: `Sections incomplete: ${missing.join(", ")}`,
        },
        requestId,
      );
    }

    const submitted = submitParentAssessment(learnerId, session!.tenantId);
    refreshLearnerReadiness(learnerId, session!.tenantId);
    audit(session, "parent_assessment.submit", requestId, { learnerId });
    return ok({ assessment: submitted }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
