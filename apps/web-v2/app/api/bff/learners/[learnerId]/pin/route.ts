import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import {
  requireSession,
  requireRole,
  requireLearnerScope,
  requireApprovedBrainForPin,
} from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import {
  isIdentitySvcEnabled,
  getIdentityBearer,
  setLearnerPinViaIdentity,
} from "@/lib/bff/identity-learners";
import { provisionAndLink } from "@/lib/bff/learner-unification";
import { getLearner } from "@/lib/db/repos";
import { advanceOnboarding } from "@/lib/onboarding-state";
import {
  isValidPin,
  setStoredLearnerPin,
  getStoredLearnerPinMeta,
} from "@/lib/db/learner-pin-store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

/** Parent-session + learner-ownership guard shared by both verbs. */
async function authorize(req: Request, requestId: string, learnerId: string) {
  const { session, response } = await requireSession(req, requestId);
  if (response) return { error: response };
  const roleErr = requireRole(session!, ["parent"], requestId);
  if (roleErr) return { error: roleErr };
  const scope = await requireLearnerScope(session!, learnerId, requestId);
  if (scope) return { error: scope };
  return { session: session! };
}

function upstreamFail(requestId: string, status: number, message: string) {
  return fail(
    { ...ERRORS.UPSTREAM_UNAVAILABLE, message, status: status >= 500 ? 502 : status },
    requestId,
  );
}

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const auth = await authorize(req, requestId, learnerId);
    if (auth.error) return auth.error;
    // The PIN itself lives in identity-svc (or, in development mode, the in-memory
    // store) and is never returned. Only expose whether one is set so the UI
    // can reflect prior state without leaking the credential.
    return ok(getStoredLearnerPinMeta(auth.session.tenantId, learnerId), requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

// 4–6 digit numeric PIN — matches identity-svc's bounds. The onboarding UI
// collects 4 digits; the wider bound keeps parity with the service contract.
const postSchema = z.object({ pin: z.string().regex(/^\d{4,6}$/) });

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const auth = await authorize(req, requestId, learnerId);
    if (auth.error) return auth.error;
    const brainGate = await requireApprovedBrainForPin(auth.session, learnerId, requestId);
    if (brainGate) return brainGate;

    const body = (await req.json().catch(() => ({}))) as { pin?: unknown };
    const parsed = postSchema.safeParse(body);
    if (!parsed.success || !isValidPin(body.pin)) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: "pin must be 4–6 digits" }, requestId);
    }
    const pin = parsed.data.pin;

    // Dual-path: when identity-svc is wired and a real access token is present,
    // set the PIN on identity-svc — the value the mobile learner `pin-login`
    // flow verifies. Otherwise persist to the in-memory store so development fallback keep
    // working without standing up the service stack.
    const bearer = await getIdentityBearer();
    if (isIdentitySvcEnabled() && bearer) {
      // Cross-platform unification (Task #34): identity-svc keys learners by
      // its own UUID, not the web `lrn_*` id. Resolve (or backfill) the link
      // so the PIN lands on the canonical learner instead of 404-ing.
      const profile = await getLearner(learnerId, auth.session.tenantId);
      const linked = profile
        ? await provisionAndLink(bearer, profile, auth.session.tenantId)
        : null;
      const identityLearnerId = linked?.identityLearnerId;
      if (!identityLearnerId) {
        // Could not resolve a canonical learner — fall back to the in-memory
        // store so the parent can still set a PIN.
        const meta = setStoredLearnerPin(auth.session.tenantId, learnerId, pin);
        await advanceOnboarding(learnerId, auth.session.tenantId, "pin_created", auth.session.userId, { via: "memory-fallback" });
        audit(auth.session, "learner.pin.set", requestId, {
          learnerId,
          metadata: { via: "memory-fallback" },
        });
        return ok(meta, requestId, { status: 201 });
      }
      const r = await setLearnerPinViaIdentity(bearer, identityLearnerId, pin);
      if (!r.ok) return upstreamFail(requestId, r.status, r.error);
      await advanceOnboarding(learnerId, auth.session.tenantId, "pin_created", auth.session.userId, { via: "identity-svc" });
      audit(auth.session, "learner.pin.set", requestId, {
        learnerId,
        metadata: { via: "identity-svc" },
      });
      return ok({ hasPin: true }, requestId, { status: 201 });
    }

    const meta = setStoredLearnerPin(auth.session.tenantId, learnerId, pin);
    await advanceOnboarding(learnerId, auth.session.tenantId, "pin_created", auth.session.userId, { via: "memory" });
    audit(auth.session, "learner.pin.set", requestId, {
      learnerId,
      metadata: { via: "memory" },
    });
    return ok(meta, requestId, { status: 201 });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
