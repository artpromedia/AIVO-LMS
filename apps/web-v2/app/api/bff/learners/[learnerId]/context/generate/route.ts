import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { checkRateLimit, RATE_LIMITS } from "@/lib/bff/rate-limit";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import {
  getIEPForLearner,
  getLearner,
  getOrCreateParentAssessment,
  listSubjects,
  refreshLearnerReadiness,
  upsertBrainProfile,
} from "@/lib/db/repos";
import { buildBrainProfile } from "@/lib/learner/brain-profile";
import { brainProfileStateSchema } from "@/lib/validators/brain-profile";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

/**
 * POST /api/bff/learners/:learnerId/context/generate
 *
 * Trigger generation of the brain profile from current context. This is the
 * orchestration entry point used after assessment+IEP. The route returns the
 * persisted brain profile or a validation error if the AI output fails the
 * schema (currently impossible with the deterministic fallback, but the gate
 * stays in place for when a real LLM is wired in).
 */
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
    const limited = checkRateLimit(
      session!.userId,
      { routeKey: "brain-profile.generate", ...RATE_LIMITS.AI_GENERATION },
      requestId,
    );
    if (limited) return limited;
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection", "ai_personalization"],
      requestId,
    );
    if (consentErr) return consentErr;

    const learner = await getLearner(learnerId, session!.tenantId);
    if (!learner) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Learner not found" }, requestId);
    }
    const assessment = await getOrCreateParentAssessment(learnerId, session!.tenantId);
    if (!assessment.submittedAt) {
      return fail(
        {
          ...ERRORS.PRECONDITION_FAILED,
          message: "Submit the parent assessment before generating the brain profile.",
        },
        requestId,
      );
    }
    const iep = getIEPForLearner(learnerId, session!.tenantId);
    const candidate = buildBrainProfile({
      learner,
      assessment,
      iepExtraction: iep?.extraction ?? null,
      iepUploaded: Boolean(iep),
      subjects: listSubjects(),
      baselineAttempts: 0,
    });
    const v = brainProfileStateSchema.safeParse(candidate);
    if (!v.success) {
      return fail(
        {
          ...ERRORS.INTERNAL_ERROR,
          message: `Brain profile failed schema: ${v.error.message}`,
        },
        requestId,
      );
    }
    const profile = upsertBrainProfile(learnerId, session!.tenantId, v.data);
    await refreshLearnerReadiness(learnerId, session!.tenantId);
    audit(session, "brain_profile.generate", requestId, {
      learnerId,
      metadata: { source: v.data.source },
    });
    return ok({ brainProfile: profile }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
