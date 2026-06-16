"use server";

/**
 * Server action behind the school / district "join with a code" onboarding
 * screens. The visitor has already self-registered (so they hold a web-v2
 * session + an identity-svc access token), which left them in a throwaway
 * tenant. This verifies the invite code against identity-svc and MOVES the
 * account into the inviting org's tenant, then re-persists the refreshed
 * session cookies (the tenant/role claims changed) before the funnel
 * continues. No duplicate tenant is created.
 *
 * Mode-aware: under `AUTH_MODE=mock` there is no identity provider wired, so
 * we preserve the historic mockup behavior and just continue the funnel.
 */
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";
import {
  identityJoinOrganization,
  extractRefreshToken,
  toSessionProfile,
  IDENTITY_ACCESS_TOKEN_COOKIE,
} from "@/lib/auth/identity-client";
import { setAuthSessionCookies } from "@/lib/auth/session-cookies";

const NEXT_STEP = "/onboarding/consent";

export type JoinOrgResult = { ok: true; redirectTo: string } | { ok: false; error: string };

export async function joinOrganizationAction(input: {
  code: string;
  email: string;
}): Promise<JoinOrgResult> {
  const code = input.code.trim();
  const email = input.email.trim();

  if (code.length < 16) {
    return { ok: false, error: "Enter the invite code your administrator sent you." };
  }

  // Mock dev mode: no identity provider. Keep the funnel moving.
  if (serverEnv.AUTH_MODE === "mock") {
    return { ok: true, redirectTo: NEXT_STEP };
  }

  const jar = await cookies();
  const accessToken = jar.get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return { ok: false, error: "Your session has expired. Please sign in again." };
  }

  const result = await identityJoinOrganization({ accessToken, code, email });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const profile = toSessionProfile(result.user);
  if (!profile) {
    return { ok: false, error: "This invitation has an unsupported role." };
  }

  setAuthSessionCookies(jar, {
    accessToken: result.accessToken,
    refreshToken: extractRefreshToken(result.setCookies),
    profile,
  });

  return { ok: true, redirectTo: NEXT_STEP };
}
