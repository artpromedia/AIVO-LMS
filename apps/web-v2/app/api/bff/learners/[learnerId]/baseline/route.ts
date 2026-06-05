import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { audit } from "@/lib/bff/audit";
import {
  createBaseline,
  getActiveBaselineForLearner,
  getBrainProfile,
  getOrCreateParentAssessment,
  listBaselineQuestions,
} from "@/lib/db/repos";
import { BaselineCreateInput } from "@/lib/validators/baseline";

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
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection"],
      requestId,
    );
    if (consentErr) return consentErr;

    const baseline = await getActiveBaselineForLearner(learnerId, session!.tenantId);
    if (!baseline) {
      return ok({ baseline: null, questions: [] }, requestId);
    }
    const questions = await listBaselineQuestions(baseline.id);
    return ok({ baseline, questions }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "learner"], requestId);
    if (roleErr) return roleErr;
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection"],
      requestId,
    );
    if (consentErr) return consentErr;

    // Preconditions: parent assessment submitted + brain profile exists.
    const assessment = await getOrCreateParentAssessment(learnerId, session!.tenantId);
    if (!assessment.submittedAt) {
      return fail(
        {
          ...ERRORS.PRECONDITION_FAILED,
          message: "Parent assessment not submitted",
          userMessage: "Finish the parent assessment before starting the baseline.",
        },
        requestId,
      );
    }
    const brain = getBrainProfile(learnerId, session!.tenantId);
    if (!brain) {
      return fail(
        {
          ...ERRORS.PRECONDITION_FAILED,
          message: "Brain profile not generated",
          userMessage: "Review the brain profile first; then we'll personalize the baseline.",
        },
        requestId,
      );
    }

    let body: unknown = {};
    try {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    const parsed = BaselineCreateInput.safeParse(body);
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
    }
    const result = await createBaseline({
      learnerId,
      tenantId: session!.tenantId,
      subjectIds: parsed.data.subjectIds,
    });
    if (!result) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Learner not found" }, requestId);
    }
    audit(session, "baseline.create", requestId, {
      learnerId,
      metadata: {
        baselineId: result.baseline.id,
        questionCount: result.questions.length,
      },
    });
    return ok(result, requestId, { status: 201 });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
