import { z } from "zod";
import { fail, ok, getRequestId } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { getSession } from "@/lib/auth/session";
import { recordAudit } from "@/lib/db/repos";
import { getTotpFactor } from "@/lib/db/mfa-store";
import { verifyTotp } from "@/lib/auth/totp";

export const dynamic = "force-dynamic";

const Schema = z.object({ code: z.string().min(6).max(8) });

/**
 * POST — verify a TOTP code against the caller's active factor. Used for
 * re-verification surfaces outside the initial login challenge (which is
 * handled by /login/mfa). Returns `{ verified: true }` on success.
 */
export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const session = await getSession();
  if (!session) {
    return fail({ ...ERRORS.UNAUTHENTICATED, message: "No session cookie" }, requestId);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(
      { ...ERRORS.VALIDATION_FAILED, message: "Could not read request body." },
      requestId,
    );
  }
  const parsed = Schema.safeParse(body);
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
    action: "mfa.totp.verify",
    metadata: { verified },
    requestId,
  });
  if (!verified) {
    return fail(
      { ...ERRORS.VALIDATION_FAILED, message: "That code is incorrect or expired." },
      requestId,
    );
  }
  return ok({ verified: true }, requestId);
}
