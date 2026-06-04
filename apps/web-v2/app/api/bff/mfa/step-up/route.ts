import { z } from "zod";
import { fail, ok, getRequestId } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { readMockSessionFromCookies } from "@/lib/auth/mock-session";
import { recordAudit } from "@/lib/db/repos";
import { getTotpFactor, grantStepUp, hasRecentStepUp, STEP_UP_TTL_SEC } from "@/lib/db/mfa-store";
import { verifyTotp } from "@/lib/auth/totp";

export const dynamic = "force-dynamic";

async function requireSession(req: Request) {
  const requestId = getRequestId(req);
  const session = await readMockSessionFromCookies();
  if (!session) {
    return { err: fail({ ...ERRORS.UNAUTHENTICATED, message: "No session cookie" }, requestId) };
  }
  return { session, requestId };
}

/**
 * POST — start a step-up challenge. Returns which factor the user must
 * present, and whether a recent step-up already satisfies the requirement.
 */
export async function POST(req: Request) {
  const got = await requireSession(req);
  if ("err" in got) return got.err;
  const { session, requestId } = got;

  const factor = getTotpFactor(session.userId);
  const enrolled = factor?.status === "active";
  await recordAudit({
    userId: session.userId,
    tenantId: session.tenantId,
    action: "mfa.step_up.challenge",
    metadata: { factor: enrolled ? "totp" : "none" },
    requestId,
  });
  return ok(
    {
      factor: enrolled ? "totp" : "none",
      satisfied: hasRecentStepUp(session.userId),
      ttlSec: STEP_UP_TTL_SEC,
    },
    requestId,
  );
}

const VerifySchema = z.object({ code: z.string().min(6).max(8) });

/**
 * PUT — complete the step-up by verifying a code. On success records an
 * `amr=mfa` grant (5-minute TTL) the caller's privileged action can rely
 * on, and emits the step-up result to the audit trail.
 */
export async function PUT(req: Request) {
  const got = await requireSession(req);
  if ("err" in got) return got.err;
  const { session, requestId } = got;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(
      { ...ERRORS.VALIDATION_FAILED, message: "Could not read request body." },
      requestId,
    );
  }
  const parsed = VerifySchema.safeParse(body);
  if (!parsed.success) {
    return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
  }

  const factor = getTotpFactor(session.userId);
  if (!factor || factor.status !== "active") {
    return fail(
      { ...ERRORS.PRECONDITION_FAILED, message: "No active authenticator. Enroll first." },
      requestId,
    );
  }

  const verified = verifyTotp(factor.secret, parsed.data.code);
  await recordAudit({
    userId: session.userId,
    tenantId: session.tenantId,
    action: "mfa.step_up.verify",
    metadata: { result: verified ? "success" : "failure" },
    requestId,
  });
  if (!verified) {
    return fail(
      { ...ERRORS.VALIDATION_FAILED, message: "That code is incorrect or expired." },
      requestId,
    );
  }

  grantStepUp(session.userId);
  return ok({ steppedUp: true, ttlSec: STEP_UP_TTL_SEC }, requestId);
}
