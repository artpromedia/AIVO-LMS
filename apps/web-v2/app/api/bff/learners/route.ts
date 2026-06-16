import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import {
  createLearner,
  listLearnersForParent,
  refreshLearnerReadiness,
  recordAgeGate,
} from "@/lib/db/repos";
import { createLearnerSchema } from "@/lib/validators/learner";
import { getTenantSeatAvailability } from "@/lib/db/seat-availability";
import { getIdentityBearer } from "@/lib/bff/identity-learners";
import { reconcileLearnersForParent, provisionAndLink } from "@/lib/bff/learner-unification";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    // Cross-platform unification (Task #34): backfill web→identity links and
    // surface mobile-origin learners before listing. Best-effort — never let a
    // reconcile failure break the parent's learner list.
    try {
      const bearer = await getIdentityBearer();
      await reconcileLearnersForParent({
        parentUserId: session!.userId,
        tenantId: session!.tenantId,
        bearer,
        log: (event, data) => audit(session, "learner.reconcile", requestId, { metadata: { event, ...data } }),
      });
    } catch {
      // swallowed: unification is opportunistic, the list below is the contract
    }
    const learners = await listLearnersForParent(session!.userId, session!.tenantId);
    for (const l of learners) {
      await refreshLearnerReadiness(l.id, session!.tenantId);
    }
    // Re-fetch after refresh so readinessState reflects any recomputation.
    const fresh = await listLearnersForParent(session!.userId, session!.tenantId);
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
      return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
    }

    // District pilot seat cap: a parent in a B2B district tenant may only add
    // learners up to tenants.seat_limit. (B2C / uncapped tenants are unlimited.)
    const seats = await getTenantSeatAvailability(session!.tenantId);
    if (!seats.allowed) {
      return fail(
        {
          code: "SEAT_LIMIT_REACHED",
          status: 409,
          message: `Seat limit reached (${seats.used}/${seats.seatLimit}) for tenant ${session!.tenantId}.`,
          userMessage:
            "Your school's plan has reached its learner seat limit. Ask your district administrator to add seats.",
          retryable: false,
        },
        requestId,
      );
    }

    let learner = await createLearner({
      tenantId: session!.tenantId,
      parentUserId: session!.userId,
      data: parsed.data,
    });
    // Cross-platform unification (Task #34): provision the canonical learner
    // in identity-svc and store the UUID on the web profile, so the learner is
    // immediately visible on mobile and the PIN step targets the real id.
    // Best-effort — identity-svc enforces its own seat caps; a failure here
    // leaves the web learner usable (the link is backfilled on next read).
    try {
      const bearer = await getIdentityBearer();
      if (bearer) {
        learner = await provisionAndLink(bearer, learner, session!.tenantId, {
          parentUserId: session!.userId,
          log: (event, data) =>
            audit(session, "learner.provision", requestId, {
              learnerId: learner.id,
              metadata: { event, ...data },
            }),
        });
      }
    } catch {
      // swallowed: provisioning is best-effort, reconcile backfills later
    }
    // Sprint 24: stamp an age-gate record at the moment of learner creation
    // so COPPA/under-13 status is recorded even if the parent skips IEP.
    const ageGate = await recordAgeGate({
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
