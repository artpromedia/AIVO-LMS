import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { isCommsSvcEnabled, getCommsBearer, sendSmsCodeSvc } from "@/lib/bff/comms-svc";
import {
  getPhoneStatus,
  normalizePhone,
  startPhoneChallenge,
  verifyPhoneChallenge,
} from "@/lib/db/parent-phone-store";

export const dynamic = "force-dynamic";

/**
 * /api/bff/onboarding/parent-verify
 *
 * Step-up phone verification for the adult on a family account (gap #7 slice 4,
 * overlapping SMS gap #22). A child profile only becomes active after a parent
 * has verified — this is how AIVO enforces parental approval.
 *
 * - `POST` issues a one-time code: validates the phone, mints + stores a hashed
 *   6-digit code in `parent-phone-store`, and delivers it over SMS. Dual-path
 *   (ADR 0009): when comms-svc is enabled and a real access token is present the
 *   code is texted via comms-svc (`providers/sms-router` → Twilio when
 *   configured); otherwise the dev path issues the challenge without a real
 *   text. The code is NEVER returned to the client.
 * - `PUT` verifies a typed code against the outstanding challenge.
 * - `GET` returns `{ phoneVerified, pendingPhone }` — never the number in full.
 */

async function authorize(req: Request, requestId: string) {
  const { session, response } = await requireSession(req, requestId);
  if (response) return { error: response };
  const roleErr = requireRole(session!, ["parent"], requestId);
  if (roleErr) return { error: roleErr };
  return { session: session! };
}

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const auth = await authorize(req, requestId);
    if (auth.error) return auth.error;
    return ok(getPhoneStatus(auth.session.userId), requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

const sendSchema = z.object({ phone: z.string().min(1) });

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const auth = await authorize(req, requestId);
    if (auth.error) return auth.error;

    const body = (await req.json().catch(() => ({}))) as { phone?: unknown };
    const parsed = sendSchema.safeParse(body);
    const phone = parsed.success ? normalizePhone(parsed.data.phone) : null;
    if (!phone) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "a valid phone number is required" },
        requestId,
      );
    }

    const { code } = startPhoneChallenge(auth.session.userId, phone);

    // Dual-path delivery. The challenge is always stored locally; comms-svc is
    // only the transport. A `disabled`/unreachable upstream is not a hard error
    // — dev/demo issue the code without a real text, so the step still works.
    let channel: "sms" | "dev" = "dev";
    const bearer = await getCommsBearer();
    if (isCommsSvcEnabled() && bearer) {
      const r = await sendSmsCodeSvc(bearer, phone, code);
      if (r.ok && r.data.status === "sent") channel = "sms";
    }

    audit(auth.session, "parent.phone.verify.requested", requestId, {
      metadata: { via: channel },
    });
    return ok({ sent: true, channel }, requestId, { status: 201 });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

const verifySchema = z.object({ code: z.string().regex(/^\d{6}$/) });

export async function PUT(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const auth = await authorize(req, requestId);
    if (auth.error) return auth.error;

    const body = (await req.json().catch(() => ({}))) as { code?: unknown };
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: "code must be 6 digits" }, requestId);
    }

    const result = verifyPhoneChallenge(auth.session.userId, parsed.data.code);
    if (!result.ok) {
      audit(auth.session, "parent.phone.verify.failed", requestId, {
        metadata: { reason: result.reason },
      });
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: `verification failed: ${result.reason}` },
        requestId,
      );
    }

    audit(auth.session, "parent.phone.verified", requestId);
    return ok({ verified: true }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
