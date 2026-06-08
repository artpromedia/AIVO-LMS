import { cookies } from "next/headers";
import { ERRORS } from "@/lib/bff/errors";
import { fail, getRequestId, ok } from "@/lib/bff/response";
import { getSession } from "@/lib/auth/session";
import { decideActiveRoleSwitch } from "@/lib/auth/active-role";

export const dynamic = "force-dynamic";

/**
 * POST /api/bff/me/active-role — Phase 1 unified-identity contract.
 *
 * Body: `{ "role": "<NavRole>" }`. Switches the session's active role
 * to `role`, enforcing step-up auth for any role where
 * `ROLE_META[role].requiresStepUp === true` (parent, teacher,
 * therapist, caregiver, and all admin roles). On success:
 *
 *   - Sets `aivo_active_role` so subsequent `GET /me` and BFF guards
 *     resolve the active role to the new value.
 *   - Mints a fresh `aivo_session_role` surface cookie via
 *     `signSurfaceCookieValue` so the edge middleware authorizes off
 *     the *active* role rather than "any role the user happens to
 *     hold" (ADR 0020 §4).
 *   - Returns the updated {@link RoleSessionPayload}.
 *
 * Failure modes return BFF-standard `{ ok:false, error:{...} }`:
 *   - 400 VALIDATION_FAILED — body missing or `role` not a known
 *     NavRole.
 *   - 403 FORBIDDEN_ROLE   — target role not in `session.roles[]`.
 *   - 403 STEP_UP_REQUIRED — step-up token missing/invalid; client
 *     should run the role-change challenge UI and retry.
 *
 * The pure decision logic lives in `lib/auth/active-role.ts` so it can
 * be unit-tested under vitest.
 */
export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const session = await getSession();
  if (!session) {
    return fail({ ...ERRORS.UNAUTHENTICATED, message: "No session cookie" }, requestId);
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const outcome = await decideActiveRoleSwitch({
    session,
    body,
    getHeader: (name) => req.headers.get(name),
  });

  if (!outcome.ok) {
    if (outcome.code === "STEP_UP_REQUIRED") {
      return fail(
        {
          ...ERRORS.STEP_UP_REQUIRED,
          message: outcome.message,
          status: outcome.status,
        },
        requestId,
      );
    }
    if (outcome.code === "FORBIDDEN_ROLE") {
      return fail(
        { ...ERRORS.FORBIDDEN_ROLE, message: outcome.message, status: outcome.status },
        requestId,
      );
    }
    return fail(
      { ...ERRORS.VALIDATION_FAILED, message: outcome.message, status: outcome.status },
      requestId,
    );
  }

  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  for (const c of outcome.cookies) {
    jar.set(c.name, c.value, {
      httpOnly: c.httpOnly,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: c.maxAge,
    });
  }
  return ok(outcome.payload, requestId);
}
