import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { createLearner, listLearnersForParent, refreshLearnerReadiness, recordAgeGate } from "@/lib/db/repos";
import { createLearnerSchema } from "@/lib/validators/learner";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const learners = listLearnersForParent(session!.userId, session!.tenantId).map((l) => {
      refreshLearnerReadiness(l.id, session!.tenantId);
      return l;
    });
    // Re-fetch after refresh so readinessState reflects any recomputation.
    const fresh = listLearnersForParent(session!.userId, session!.tenantId);
    return ok({ learners: fresh.length ? fresh : learners }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const json = await req.json().catch(() => ({}));
    const parsed = createLearnerSchema.safeParse(json);
    if (!parsed.success) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: parsed.error.message },
        requestId,
      );
    }
    const learner = createLearner({
      tenantId: session!.tenantId,
      parentUserId: session!.userId,
      data: parsed.data,
    });
    // Sprint 24: stamp an age-gate record at the moment of learner creation
    // so COPPA/under-13 status is recorded even if the parent skips IEP.
    const ageGate = recordAgeGate({
      tenantId: session!.tenantId,
      learnerId: learner.id,
      recordedByUserId: session!.userId,
      ageRange: learner.ageRange ?? null,
    });
    audit(session, "learner.create", requestId, {
      learnerId: learner.id,
      metadata: {
        displayName: learner.displayName,
        ageRange: learner.ageRange,
        requiresParentConsent: ageGate.requiresParentConsent,
      },
    });
    return ok({ learner, ageGate }, requestId, { status: 201 });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
