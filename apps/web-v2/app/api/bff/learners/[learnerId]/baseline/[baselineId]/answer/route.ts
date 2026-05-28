import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { audit } from "@/lib/bff/audit";
import { getBaselineById, recordBaselineAttempt } from "@/lib/db/repos";
import { BaselineAnswerInput } from "@/lib/validators/baseline";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string; baselineId: string }> };

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId, baselineId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "learner"], requestId);
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

    const baseline = await getBaselineById(baselineId, session!.tenantId);
    if (!baseline || baseline.learnerId !== learnerId) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Baseline not found" }, requestId);
    }
    if (baseline.status === "complete") {
      return fail(
        {
          ...ERRORS.CONFLICT,
          message: "Baseline already complete",
          userMessage: "This baseline is already finished.",
        },
        requestId,
      );
    }

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: "Invalid JSON body" }, requestId);
    }
    const parsed = BaselineAnswerInput.safeParse(body);
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
    }
    const attempt = await recordBaselineAttempt({
      baselineId,
      questionId: parsed.data.questionId,
      learnerId,
      tenantId: session!.tenantId,
      response: parsed.data.response,
      skipped: parsed.data.skipped,
    });
    if (!attempt) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Question not found for baseline" }, requestId);
    }
    audit(session, "baseline.answer", requestId, {
      learnerId,
      metadata: {
        baselineId,
        questionId: parsed.data.questionId,
        skipped: !!parsed.data.skipped,
        isCorrect: attempt.isCorrect,
      },
    });
    return ok({ attempt }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
