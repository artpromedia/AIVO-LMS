import { cookies } from "next/headers";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { serverEnv } from "@/lib/env";
import {
  IDENTITY_REFRESH_TOKEN_COOKIE,
  extractRefreshToken,
  identityRefresh,
} from "@/lib/auth/identity-client";
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthSessionCookies,
} from "@/lib/auth/session-cookies";

export const dynamic = "force-dynamic";

/**
 * Mint a fresh access token using the refresh-token cookie. Mock mode
 * has nothing to refresh — return a clean 404 so the client can decide
 * to fall back to a full re-login.
 *
 * Success body:
 *   {
 *     ok: true,
 *     data: { mustChangePassword, passwordRotationDue }
 *   }
 *
 * Failure (no/expired refresh token) sends 401 and clears every auth
 * cookie so the next server-component render redirects to /login.
 */
export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    if (serverEnv.AUTH_MODE === "mock") {
      return fail(
        {
          code: "REFRESH_UNAVAILABLE_IN_MOCK",
          status: 404,
          message: "Refresh is disabled in mock mode.",
          userMessage: "Sign in again to continue.",
          retryable: false,
        },
        requestId,
      );
    }

    const jar = await cookies();
    const refresh = jar.get(IDENTITY_REFRESH_TOKEN_COOKIE)?.value;
    if (!refresh) {
      clearAuthSessionCookies(jar);
      return fail(
        {
          ...ERRORS.UNAUTHENTICATED,
          message: "No refresh token present.",
        },
        requestId,
      );
    }

    const result = await identityRefresh(refresh);
    if (!result.ok) {
      clearAuthSessionCookies(jar);
      return fail(
        {
          ...ERRORS.UNAUTHENTICATED,
          status: result.status,
          message: result.error,
        },
        requestId,
      );
    }

    setAccessTokenCookie(jar, result.accessToken);

    // identity-svc may rotate the refresh-token cookie (currently it
    // doesn't, but the contract allows it). Mirror any rotated cookie
    // onto the web-v2 origin so the next refresh keeps working.
    const rotated = extractRefreshToken(result.setCookies);
    if (rotated) {
      setRefreshTokenCookie(jar, rotated);
    }

    return ok(
      {
        mustChangePassword: result.mustChangePassword,
        passwordRotationDue: result.passwordRotationDue,
      },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
