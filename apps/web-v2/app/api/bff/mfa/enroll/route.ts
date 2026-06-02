import { z } from "zod";
import { fail, ok, getRequestId } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { readMockSessionFromCookies } from "@/lib/auth/mock-session";
import { recordAudit } from "@/lib/db/repos";
import {
  startTotpEnrollment,
  getTotpFactor,
  activateTotpFactor,
  getMfaStatus,
} from "@/lib/db/mfa-store";
import { otpauthUrl, verifyTotp } from "@/lib/auth/totp";

export const dynamic = "force-dynamic";

async function requireSession(req: Request) {
  const requestId = getRequestId(req);
  const session = await readMockSessionFromCookies();
  if (!session) {
    return { err: fail({ ...ERRORS.UNAUTHENTICATED, message: "No session cookie" }, requestId) };
  }
  return { session, requestId };
}

/** GET — current MFA enrollment status. */
export async function GET(req: Request) {
  const got = await requireSession(req);
  if ("err" in got) return got.err;
  return ok(getMfaStatus(got.session.userId), got.requestId);
}

/** POST — begin TOTP enrollment; returns the secret + otpauth URI to scan. */
export async function POST(req: Request) {
  const got = await requireSession(req);
  if ("err" in got) return got.err;
  const { session, requestId } = got;

  const factor = startTotpEnrollment(session.userId);
  await recordAudit({
    userId: session.userId,
    tenantId: session.tenantId,
    action: "mfa.totp.enroll_started",
    requestId,
  });
  return ok(
    {
      secret: factor.secret,
      otpauthUrl: otpauthUrl({
        secret: factor.secret,
        accountName: session.email,
        issuer: "AIVO",
      }),
    },
    requestId,
  );
}

const ConfirmSchema = z.object({ code: z.string().min(6).max(8) });

/** PUT — confirm enrollment with a code from the authenticator app. */
export async function PUT(req: Request) {
  const got = await requireSession(req);
  if ("err" in got) return got.err;
  const { session, requestId } = got;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail({ ...ERRORS.VALIDATION_FAILED, message: "Could not read request body." }, requestId);
  }
  const parsed = ConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
  }

  const factor = getTotpFactor(session.userId);
  if (!factor) {
    return fail(
      { ...ERRORS.PRECONDITION_FAILED, message: "Start enrollment before confirming." },
      requestId,
    );
  }
  if (!verifyTotp(factor.secret, parsed.data.code)) {
    return fail({ ...ERRORS.VALIDATION_FAILED, message: "That code is incorrect or expired." }, requestId);
  }

  activateTotpFactor(session.userId);
  await recordAudit({
    userId: session.userId,
    tenantId: session.tenantId,
    action: "mfa.totp.enrolled",
    requestId,
  });
  return ok({ enrolled: true }, requestId);
}
