import { cookies } from "next/headers";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { serverEnv } from "@/lib/env";
import { MOCK_COOKIE_NAME } from "@/lib/auth/mock-session";

export const dynamic = "force-dynamic";

/**
 * JSON-API logout (standard BFF envelope). Best-effort invalidates the
 * refresh-token row in identity-svc, then clears every auth cookie on the
 * web-v2 origin. The server-action counterpart is `logoutAction`
 * (lib/auth/actions.ts); this route exists for JSON clients.
 *
 * Mode-aware: always clears the mock cookie so a stale dev login can't linger,
 * and additionally tears down the real session in non-mock mode.
 */
export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const jar = await cookies();
    jar.set(MOCK_COOKIE_NAME, "", { path: "/", maxAge: 0 });

    if (serverEnv.AUTH_MODE !== "mock") {
      const { identityLogout, IDENTITY_REFRESH_TOKEN_COOKIE } =
        await import("@/lib/auth/identity-client");
      const { clearAuthSessionCookies } = await import("@/lib/auth/session-cookies");
      const refresh = jar.get(IDENTITY_REFRESH_TOKEN_COOKIE)?.value ?? null;
      await identityLogout(refresh);
      clearAuthSessionCookies(jar);
    }

    return ok({ redirectTo: "/login" }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
