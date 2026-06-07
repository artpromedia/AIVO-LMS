import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { parentCanAccessLearner } from "@/lib/db/repos";
import {
  isFamilySvcEnabled,
  getFamilyBearer,
  getSpeechBuddyConsent,
  grantSpeechBuddyConsent,
  revokeSpeechBuddyConsent,
} from "@/lib/bff/family-svc";
import {
  isValidAgeBand,
  getStoredConsent,
  grantStoredConsent,
  revokeStoredConsent,
} from "@/lib/db/speech-buddy-consent-store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

/** Parent-session + learner-ownership guard shared by all three verbs. */
async function authorize(req: Request, requestId: string, learnerId: string) {
  const { session, response } = await requireSession(req, requestId);
  if (response) return { error: response };
  const roleErr = requireRole(session!, ["parent"], requestId);
  if (roleErr) return { error: roleErr };
  if (!(await parentCanAccessLearner(session!.userId, learnerId, session!.tenantId))) {
    return {
      error: fail({ ...ERRORS.FORBIDDEN_LEARNER, message: "Learner not found." }, requestId),
    };
  }
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

    const bearer = await getFamilyBearer();
    if (isFamilySvcEnabled() && bearer) {
      const r = await getSpeechBuddyConsent(bearer, learnerId);
      if (!r.ok) return upstreamFail(requestId, r.status, r.error);
      return ok(r.data, requestId);
    }
    const rec = getStoredConsent(auth.session.tenantId, learnerId);
    return ok(
      {
        granted: Boolean(rec),
        consent: rec ? { id: rec.id, ageBand: rec.ageBand, scope: rec.scope } : null,
      },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

const postSchema = z.object({ ageBand: z.enum(["3-5", "6-9", "10-12", "13-15"]) });

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const auth = await authorize(req, requestId, learnerId);
    if (auth.error) return auth.error;

    const body = await req.json().catch(() => ({}));
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "ageBand must be 3-5 / 6-9 / 10-12 / 13-15." },
        requestId,
      );
    }
    const { ageBand } = parsed.data;

    const bearer = await getFamilyBearer();
    if (isFamilySvcEnabled() && bearer) {
      const r = await grantSpeechBuddyConsent(bearer, learnerId, ageBand);
      if (!r.ok) return upstreamFail(requestId, r.status, r.error);
      audit(auth.session, "speech_buddy.consent.granted", requestId, {
        learnerId,
        metadata: { ageBand },
      });
      return ok({ granted: true, ageBand }, requestId);
    }

    if (!isValidAgeBand(ageBand)) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: "Invalid ageBand." }, requestId);
    }
    grantStoredConsent(auth.session.tenantId, learnerId, ageBand);
    audit(auth.session, "speech_buddy.consent.granted", requestId, {
      learnerId,
      metadata: { ageBand, store: "memory" },
    });
    return ok({ granted: true, ageBand }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function DELETE(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const auth = await authorize(req, requestId, learnerId);
    if (auth.error) return auth.error;

    const bearer = await getFamilyBearer();
    if (isFamilySvcEnabled() && bearer) {
      const r = await revokeSpeechBuddyConsent(bearer, learnerId);
      if (!r.ok) return upstreamFail(requestId, r.status, r.error);
      audit(auth.session, "speech_buddy.consent.revoked", requestId, { learnerId });
      return ok({ revoked: true }, requestId);
    }
    revokeStoredConsent(auth.session.tenantId, learnerId);
    audit(auth.session, "speech_buddy.consent.revoked", requestId, {
      learnerId,
      metadata: { store: "memory" },
    });
    return ok({ revoked: true }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
