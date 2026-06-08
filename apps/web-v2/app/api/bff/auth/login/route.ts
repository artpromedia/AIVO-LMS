import { cookies } from "next/headers";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { serverEnv } from "@/lib/env";
import { isMockAuthAllowed } from "@/lib/auth/mock-session";
import { ROLE_HOME } from "@/lib/auth/types";
import { MFA_CHALLENGE_COOKIE, MFA_CHALLENGE_MAX_AGE_SECONDS } from "@/lib/auth/mfa-cookies";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Real login BFF (the pilot path). Proxies credentials to identity-svc
 * `/api/auth/login`, sets the httpOnly access + refresh + session-snapshot
 * cookies on the web-v2 origin, and returns `{ session, redirectTo }`.
 *
 * Outcomes mirror the identity-svc contract:
 *   - MFA pending: stashes the (sensitive) mfaToken in a short-lived httpOnly
 *     cookie — never the JSON body — and returns `{ mfaPending, redirectTo }`.
 *   - mustChangePassword: passed through so the client can route to the
 *     change-password surface.
 *   - wrong-surface 403: forwards identity-svc's `redirectTo` when safe.
 *
 * Mock mode has no real credentials to proxy — the dev entrypoint is
 * `POST /api/bff/auth/mock-login`, so this route returns a clean 404 there.
 */
export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    if (isMockAuthAllowed()) {
      return fail(
        {
          code: "REAL_LOGIN_DISABLED_IN_MOCK",
          status: 404,
          message: "Real login is unavailable in mock mode.",
          userMessage: "This endpoint is not available.",
          retryable: false,
        },
        requestId,
      );
    }

    const json = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
    }

    const { identityLogin, extractRefreshToken, toSessionProfile } =
      await import("@/lib/auth/identity-client");
    const { setAuthSessionCookies } = await import("@/lib/auth/session-cookies");

    const result = await identityLogin(parsed.data.email, parsed.data.password);

    if (result.kind === "mfa") {
      const jar = await cookies();
      jar.set(
        MFA_CHALLENGE_COOKIE,
        encodeURIComponent(JSON.stringify({ token: result.mfaToken, method: result.mfaMethod })),
        {
          httpOnly: true,
          sameSite: "lax",
          secure: serverEnv.NODE_ENV === "production",
          path: "/",
          maxAge: MFA_CHALLENGE_MAX_AGE_SECONDS,
        },
      );
      return ok(
        { mfaPending: true, mfaMethod: result.mfaMethod, redirectTo: "/login/mfa" },
        requestId,
      );
    }

    if (result.kind === "error") {
      if (result.status === 403 && result.redirectTo) {
        const { isSafeSurfaceRedirect } = await import("@/lib/auth/surface-redirect");
        if (isSafeSurfaceRedirect(result.redirectTo)) {
          return ok(
            { redirectTo: result.redirectTo, wrongSurface: result.wrongSurface },
            requestId,
          );
        }
      }
      const status = result.status === 401 || result.status === 403 ? result.status : 502;
      return fail(
        {
          code:
            status === 401
              ? "INVALID_CREDENTIALS"
              : status === 403
                ? "WRONG_SURFACE"
                : "LOGIN_FAILED",
          status,
          message: result.error,
          userMessage:
            status === 401
              ? "That email or password is incorrect."
              : status === 403
                ? "This account signs in on a different portal."
                : "Sign-in failed. Please try again.",
          retryable: status >= 500,
        },
        requestId,
      );
    }

    const profile = toSessionProfile(result.user);
    if (!profile) {
      return fail(
        {
          code: "UNSUPPORTED_ROLE",
          status: 422,
          message: `Unsupported role: ${result.user?.role}`,
          userMessage: "This account type can't sign in here.",
          retryable: false,
        },
        requestId,
      );
    }

    const jar = await cookies();
    setAuthSessionCookies(jar, {
      accessToken: result.accessToken,
      refreshToken: extractRefreshToken(result.setCookies),
      profile,
    });

    return ok(
      {
        session: profile,
        redirectTo: ROLE_HOME[profile.role],
        mustChangePassword: Boolean(result.mustChangePassword),
      },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
