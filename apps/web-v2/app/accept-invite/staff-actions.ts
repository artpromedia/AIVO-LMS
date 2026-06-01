"use server";

import { cookies } from "next/headers";
import {
  identityAcceptInvite,
  extractRefreshToken,
  toSessionProfile,
} from "@/lib/auth/identity-client";
import { setAuthSessionCookies } from "@/lib/auth/session-cookies";
import { ROLE_HOME } from "@/lib/auth/types";

/**
 * Server action behind the staff invite "set your password" form.
 *
 * Calls identity-svc `/api/auth/accept-invite`, which creates the account
 * and returns an access token + refresh cookie. We persist those on the
 * web-v2 domain (same as login) so the new admin/teacher lands signed in,
 * then hand the client a role-appropriate redirect target.
 */
export type StaffAcceptResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string; reasons?: string[] };

export async function acceptStaffInviteAction(
  token: string,
  password: string,
  confirmPassword: string,
): Promise<StaffAcceptResult> {
  if (!token) return { ok: false, error: "This invitation link is missing its token." };
  if (password.length < 8) {
    return { ok: false, error: "Choose a password with at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { ok: false, error: "Those passwords don't match." };
  }

  const result = await identityAcceptInvite(token, password);
  if (!result.ok) {
    return { ok: false, error: result.error, reasons: result.reasons };
  }

  const profile = toSessionProfile(result.user);
  if (!profile) {
    return { ok: false, error: "This invitation has an unsupported role." };
  }

  const jar = await cookies();
  setAuthSessionCookies(jar, {
    accessToken: result.accessToken,
    refreshToken: extractRefreshToken(result.setCookies),
    profile,
  });

  return { ok: true, redirectTo: ROLE_HOME[profile.role] ?? "/" };
}
