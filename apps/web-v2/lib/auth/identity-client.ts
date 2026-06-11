/**
 * Thin server-side HTTP client for services/identity-svc.
 *
 * Web-v2 talks to identity-svc as a BFF: the Next server makes the call
 * inside a server action / route handler, then sets its OWN httpOnly
 * cookies on the web-v2 domain. We do NOT forward identity-svc cookies
 * verbatim because they are scoped to the identity-svc origin in
 * production. Only the access token + a session-profile snapshot are
 * persisted on the web-v2 side; the refresh token is kept server-side
 * (re-fetched from identity-svc via the bearer token when needed).
 *
 * This module is server-only. It's only imported from server actions
 * and route handlers; do not import it from client components.
 */
import { serverEnv } from "@/lib/env";
import type { Role, SessionProfile } from "./types";
import { capabilitiesForRole } from "./permissions";

export const IDENTITY_ACCESS_TOKEN_COOKIE = "aivo_access_token";
export const IDENTITY_REFRESH_TOKEN_COOKIE = "aivo_refresh_token";
export const IDENTITY_SESSION_COOKIE = "aivo_session";

/**
 * identity-svc emits uppercase enum-like role names; web-v2 uses
 * lowercase. Map both directions so we never leak the wire format into
 * the UI layer.
 */
const WIRE_TO_ROLE: Record<string, Role> = {
  PARENT: "parent",
  LEARNER: "learner",
  TEACHER: "teacher",
  CAREGIVER: "caregiver",
  THERAPIST: "therapist",
  SCHOOL_ADMIN: "school_admin",
  DISTRICT_ADMIN: "district_admin",
  PLATFORM_ADMIN: "platform_admin",
  SUPPORT: "support",
  MARKETING: "marketing",
  SALES: "sales",
  DEVOPS: "devops",
  ENGINEERING: "engineering",
};

export function mapWireRoleToRole(wire: string | undefined | null): Role | null {
  if (!wire) return null;
  return WIRE_TO_ROLE[wire.toUpperCase()] ?? null;
}

export type IdentityUser = {
  id: string;
  email: string;
  name: string | null;
  role: string; // wire format (uppercase)
  tenantId: string;
  /** Sprint A8 — set by /api/users/me + the timezone PATCH. */
  timezone?: string | null;
};

export type IdentityLoginSuccess = {
  kind: "ok";
  user: IdentityUser;
  accessToken: string;
  mustChangePassword?: boolean;
  /** Raw Set-Cookie strings from identity-svc (e.g. refreshToken). */
  setCookies: string[];
};

export type IdentityLoginMfa = {
  kind: "mfa";
  mfaToken: string;
  mfaMethod: string;
};

export type IdentityLoginError = {
  kind: "error";
  status: number;
  error: string;
  redirectTo?: string;
  wrongSurface?: string;
};

export type IdentityLoginResult = IdentityLoginSuccess | IdentityLoginMfa | IdentityLoginError;

/**
 * Extract Set-Cookie headers across runtimes. Node 18+ exposes
 * `getSetCookie()`; older fetch implementations fall back to raw
 * iteration.
 */
function readSetCookies(headers: Headers): string[] {
  const anyHeaders = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie();
  }
  const value = headers.get("set-cookie");
  return value ? [value] : [];
}

function parseRefreshToken(setCookies: string[]): string | null {
  for (const raw of setCookies) {
    const first = raw.split(";", 1)[0]?.trim();
    if (!first) continue;
    const eq = first.indexOf("=");
    if (eq <= 0) continue;
    const name = first.slice(0, eq).trim();
    if (name === "refreshToken") {
      return decodeURIComponent(first.slice(eq + 1));
    }
  }
  return null;
}

/**
 * POST /api/auth/login on identity-svc with the user's credentials.
 * Returns a discriminated union for the three legitimate outcomes.
 */
export async function identityLogin(email: string, password: string): Promise<IdentityLoginResult> {
  let res: Response;
  try {
    res = await fetch(`${serverEnv.IDENTITY_SVC_URL}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
      // Server-to-server; never cache.
      cache: "no-store",
    });
  } catch (err) {
    return {
      kind: "error",
      status: 502,
      error: `identity-svc unreachable: ${(err as Error).message}`,
    };
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    return {
      kind: "error",
      status: res.status,
      error: typeof json.error === "string" ? json.error : "Login failed",
      redirectTo: typeof json.redirectTo === "string" ? json.redirectTo : undefined,
      wrongSurface: typeof json.wrongSurface === "string" ? json.wrongSurface : undefined,
    };
  }

  if (json.mfaPending) {
    return {
      kind: "mfa",
      mfaToken: typeof json.mfaToken === "string" ? json.mfaToken : "",
      mfaMethod: typeof json.mfaMethod === "string" ? json.mfaMethod : "",
    };
  }

  return {
    kind: "ok",
    user: json.user as IdentityUser,
    accessToken: typeof json.accessToken === "string" ? json.accessToken : "",
    mustChangePassword: Boolean(json.mustChangePassword),
    setCookies: readSetCookies(res.headers),
  };
}

export function extractRefreshToken(setCookies: string[]): string | null {
  return parseRefreshToken(setCookies);
}

export type IdentityRegisterSuccess = {
  kind: "ok";
  user: IdentityUser;
  accessToken: string;
  /** Raw Set-Cookie strings from identity-svc (e.g. refreshToken). */
  setCookies: string[];
};

export type IdentityRegisterError = {
  kind: "error";
  status: number;
  error: string;
  /** Password-policy violation reasons returned on a 400. */
  reasons?: string[];
  strengthScore?: number;
};

export type IdentityRegisterResult = IdentityRegisterSuccess | IdentityRegisterError;

/**
 * POST /api/auth/register on identity-svc to create a self-service
 * account. Self-registration is PARENT-only server-side (it provisions a
 * B2C_FAMILY tenant), so `role` is fixed to "PARENT". The success shape
 * mirrors /api/auth/login — `{ user, accessToken }` plus a `refreshToken`
 * Set-Cookie — so the caller can re-use the same cookie-setting path.
 */
export async function identityRegister(input: {
  name: string;
  email: string;
  password: string;
}): Promise<IdentityRegisterResult> {
  let res: Response;
  try {
    res = await fetch(`${serverEnv.IDENTITY_SVC_URL}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        password: input.password,
        role: "PARENT",
      }),
      cache: "no-store",
    });
  } catch (err) {
    return {
      kind: "error",
      status: 502,
      error: `identity-svc unreachable: ${(err as Error).message}`,
    };
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const reasons = Array.isArray(json.reasons)
      ? (json.reasons.filter((r) => typeof r === "string") as string[])
      : undefined;
    return {
      kind: "error",
      status: res.status,
      error: typeof json.error === "string" ? json.error : "Registration failed",
      reasons,
      strengthScore: typeof json.strengthScore === "number" ? json.strengthScore : undefined,
    };
  }

  return {
    kind: "ok",
    user: json.user as IdentityUser,
    accessToken: typeof json.accessToken === "string" ? json.accessToken : "",
    setCookies: readSetCookies(res.headers),
  };
}

/**
 * Shared implementation for the dedicated staff login endpoints. Both
 * `/api/auth/admin-login` and `/api/auth/district-login` accept the same
 * `{ email, password }` payload and return the same shape as
 * `/api/auth/login` (including the `mfaPending` path — staff accounts
 * are MFA-required server-side).
 */
async function identityStaffLogin(
  path: "admin-login" | "district-login",
  email: string,
  password: string,
): Promise<IdentityLoginResult> {
  let res: Response;
  try {
    res = await fetch(`${serverEnv.IDENTITY_SVC_URL}/api/auth/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch (err) {
    return {
      kind: "error",
      status: 502,
      error: `identity-svc unreachable: ${(err as Error).message}`,
    };
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    return {
      kind: "error",
      status: res.status,
      error: typeof json.error === "string" ? json.error : "Login failed",
      redirectTo: typeof json.redirectTo === "string" ? json.redirectTo : undefined,
      wrongSurface: typeof json.wrongSurface === "string" ? json.wrongSurface : undefined,
    };
  }

  if (json.mfaPending) {
    return {
      kind: "mfa",
      mfaToken: typeof json.mfaToken === "string" ? json.mfaToken : "",
      mfaMethod: typeof json.mfaMethod === "string" ? json.mfaMethod : "",
    };
  }

  return {
    kind: "ok",
    user: json.user as IdentityUser,
    accessToken: typeof json.accessToken === "string" ? json.accessToken : "",
    mustChangePassword: Boolean(json.mustChangePassword),
    setCookies: readSetCookies(res.headers),
  };
}

export function identityAdminLogin(email: string, password: string): Promise<IdentityLoginResult> {
  return identityStaffLogin("admin-login", email, password);
}

export function identityDistrictLogin(
  email: string,
  password: string,
): Promise<IdentityLoginResult> {
  return identityStaffLogin("district-login", email, password);
}

/**
 * Complete an MFA challenge for one of the supported factors:
 *   - email OTP (6-digit)
 *   - TOTP authenticator code (6-digit)
 *   - recovery code (12-char, optionally dash-separated)
 *
 * Server response shape mirrors /api/auth/login on success, so the
 * caller can re-use the same cookie-setting logic. Returns the same
 * discriminated union, minus the `mfa` arm (a second MFA round is not
 * supported).
 */
export async function identityVerifyMfa(
  mfaToken: string,
  code: string,
): Promise<IdentityLoginSuccess | IdentityLoginError> {
  let res: Response;
  try {
    res = await fetch(`${serverEnv.IDENTITY_SVC_URL}/api/auth/verify-mfa`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mfaToken, code }),
      cache: "no-store",
    });
  } catch (err) {
    return {
      kind: "error",
      status: 502,
      error: `identity-svc unreachable: ${(err as Error).message}`,
    };
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    return {
      kind: "error",
      status: res.status,
      error: typeof json.error === "string" ? json.error : "MFA verification failed",
    };
  }

  return {
    kind: "ok",
    user: json.user as IdentityUser,
    accessToken: typeof json.accessToken === "string" ? json.accessToken : "",
    mustChangePassword: Boolean(json.mustChangePassword),
    setCookies: readSetCookies(res.headers),
  };
}

/**
 * Resend the email OTP for an in-flight MFA challenge. Only valid when
 * the original challenge method was "email" — identity-svc rejects
 * resend for TOTP/WebAuthn challenges.
 */
export async function identityResendMfa(
  mfaToken: string,
): Promise<{ ok: true; resendsRemaining: number } | { ok: false; status: number; error: string }> {
  let res: Response;
  try {
    res = await fetch(`${serverEnv.IDENTITY_SVC_URL}/api/auth/mfa/resend`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mfaToken }),
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, status: 502, error: `identity-svc unreachable: ${(err as Error).message}` };
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: typeof json.error === "string" ? json.error : "Failed to resend code",
    };
  }
  return {
    ok: true,
    resendsRemaining: typeof json.resendsRemaining === "number" ? json.resendsRemaining : 0,
  };
}

export type IdentityRefreshResult =
  | {
      ok: true;
      accessToken: string;
      mustChangePassword: boolean;
      passwordRotationDue: boolean;
      setCookies: string[];
    }
  | { ok: false; status: number; error: string };

/**
 * Exchange a refresh token for a fresh access token. The caller passes
 * the raw refresh-token string captured from the original login (kept
 * on the web-v2 domain in `aivo_refresh_token`). identity-svc reads it
 * from the `refreshToken` cookie header.
 */
export async function identityRefresh(refreshToken: string): Promise<IdentityRefreshResult> {
  let res: Response;
  try {
    res = await fetch(`${serverEnv.IDENTITY_SVC_URL}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `refreshToken=${encodeURIComponent(refreshToken)}`,
      },
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, status: 502, error: `identity-svc unreachable: ${(err as Error).message}` };
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: typeof json.error === "string" ? json.error : "Refresh failed",
    };
  }
  return {
    ok: true,
    accessToken: typeof json.accessToken === "string" ? json.accessToken : "",
    mustChangePassword: Boolean(json.mustChangePassword),
    passwordRotationDue: Boolean(json.passwordRotationDue),
    setCookies: readSetCookies(res.headers),
  };
}

/**
 * Trigger a password-reset email. identity-svc always returns 200 with
 * a generic message regardless of whether the email exists, to prevent
 * account enumeration. We mirror that behavior here.
 */
export async function identityForgotPassword(
  email: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  let res: Response;
  try {
    res = await fetch(`${serverEnv.IDENTITY_SVC_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, status: 502, error: `identity-svc unreachable: ${(err as Error).message}` };
  }
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      ok: false,
      status: res.status,
      error: typeof json.error === "string" ? json.error : "Request failed",
    };
  }
  return { ok: true };
}

export type IdentityResetPasswordResult =
  | { ok: true }
  | {
      ok: false;
      status: number;
      error: string;
      /** Policy-violation reasons returned by /api/auth/reset-password. */
      reasons?: string[];
      strengthScore?: number;
    };

/**
 * Complete a password reset. Identity-svc validates the token, runs the
 * new password through the policy engine (history, blacklist, strength),
 * and invalidates every active session on success.
 */
export async function identityResetPassword(
  token: string,
  newPassword: string,
): Promise<IdentityResetPasswordResult> {
  let res: Response;
  try {
    res = await fetch(`${serverEnv.IDENTITY_SVC_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, status: 502, error: `identity-svc unreachable: ${(err as Error).message}` };
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const reasons = Array.isArray(json.reasons)
      ? (json.reasons.filter((r) => typeof r === "string") as string[])
      : undefined;
    return {
      ok: false,
      status: res.status,
      error: typeof json.error === "string" ? json.error : "Reset failed",
      reasons,
      strengthScore: typeof json.strengthScore === "number" ? json.strengthScore : undefined,
    };
  }
  return { ok: true };
}

/**
 * POST /api/auth/logout. Best-effort — failures are swallowed because
 * the client-side cookies are cleared regardless.
 */
export async function identityLogout(refreshToken: string | null): Promise<void> {
  if (!refreshToken) return;
  try {
    await fetch(`${serverEnv.IDENTITY_SVC_URL}/api/auth/logout`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // identity-svc reads the refresh token from the `refreshToken`
        // cookie. Send it on the server-to-server call so the row is
        // invalidated in the sessions table.
        cookie: `refreshToken=${encodeURIComponent(refreshToken)}`,
      },
      cache: "no-store",
    });
  } catch {
    // Network failure — fall through. Cookies still cleared client-side.
  }
}

/**
 * Build a SessionProfile from an identity-svc user payload. The active
 * role's capabilities are derived from the shared @aivo/security matrix so
 * the web shell stays coherent even before/after a role switch.
 */
export function toSessionProfile(user: IdentityUser): SessionProfile | null {
  const role = mapWireRoleToRole(user.role);
  if (!role) return null;
  const permissions = capabilitiesForRole(role);
  return {
    userId: user.id,
    tenantId: user.tenantId,
    role,
    email: user.email,
    displayName: user.name ?? user.email,
    permissions,
    capabilities: permissions,
    timezone: user.timezone ?? null,
  };
}

/* -------------------------------------------------------------------------
 * Staff invite acceptance (district-admin / school-admin / teacher).
 *
 * Invites are created on identity-svc (token-hashed `districtAdminInvites`
 * rows) and delivered by email with a `/accept-invite?token=…` link. These
 * two BFF helpers let the web accept-invite page preview the invite and
 * complete acceptance (which creates the account + auto-logs the user in).
 * ---------------------------------------------------------------------- */

export type InvitePreview = {
  email: string;
  name: string;
  role: string; // wire format (uppercase)
  schoolName: string | null;
  districtName: string | null;
  expiresAt: string;
};

export type IdentityInvitePreviewResult =
  | { ok: true; invite: InvitePreview }
  | { ok: false; status: number; error: string };

/**
 * GET /api/auth/invite/:token — public preview. Returns a friendly error
 * (invalid / expired / already-accepted) the page can render verbatim.
 */
export async function identityInvitePreview(token: string): Promise<IdentityInvitePreviewResult> {
  let res: Response;
  try {
    res = await fetch(
      `${serverEnv.IDENTITY_SVC_URL}/api/auth/invite/${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
  } catch (err) {
    return { ok: false, status: 502, error: `identity-svc unreachable: ${(err as Error).message}` };
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: typeof json.error === "string" ? json.error : "This invitation could not be found.",
    };
  }
  return { ok: true, invite: json.invite as InvitePreview };
}

export type IdentityAcceptInviteResult =
  | { ok: true; user: IdentityUser; accessToken: string; setCookies: string[] }
  | { ok: false; status: number; error: string; reasons?: string[] };

/**
 * POST /api/auth/accept-invite — sets the chosen password, which creates
 * the account and returns an access token + refresh cookie for auto-login.
 * The caller is responsible for persisting the session on the web-v2 domain
 * (same as login).
 */
export async function identityAcceptInvite(
  token: string,
  password: string,
): Promise<IdentityAcceptInviteResult> {
  let res: Response;
  try {
    res = await fetch(`${serverEnv.IDENTITY_SVC_URL}/api/auth/accept-invite`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, status: 502, error: `identity-svc unreachable: ${(err as Error).message}` };
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const reasons = Array.isArray(json.reasons)
      ? (json.reasons.filter((r) => typeof r === "string") as string[])
      : undefined;
    return {
      ok: false,
      status: res.status,
      error: typeof json.error === "string" ? json.error : "Could not accept this invitation.",
      reasons,
    };
  }
  return {
    ok: true,
    user: json.user as IdentityUser,
    accessToken: typeof json.accessToken === "string" ? json.accessToken : "",
    setCookies: readSetCookies(res.headers),
  };
}

export type IdentityInviteTeacherResult =
  | {
      ok: true;
      invite: { id: string; email: string; name: string; schoolId: string; expiresAt: string };
    }
  | { ok: false; status: number; error: string };

/**
 * POST /api/school/teachers — invite a teacher to a school.
 * `accessToken` is the district/school admin's bearer JWT (read from the
 * `aivo_access_token` cookie). A SCHOOL_ADMIN token pins the school, so only
 * {email, name} are required; a DISTRICT_ADMIN must pass `schoolId`.
 */
export async function identityInviteTeacher(
  accessToken: string,
  input: { email: string; name: string; schoolId?: string },
): Promise<IdentityInviteTeacherResult> {
  let res: Response;
  try {
    res = await fetch(`${serverEnv.IDENTITY_SVC_URL}/api/school/teachers`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, status: 502, error: `identity-svc unreachable: ${(err as Error).message}` };
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: typeof json.error === "string" ? json.error : "Could not send the invitation.",
    };
  }
  return {
    ok: true,
    invite: json.invite as {
      id: string;
      email: string;
      name: string;
      schoolId: string;
      expiresAt: string;
    },
  };
}

/* -------------------------------------------------------------------------
 * District admin console (real-auth). Helpers for the district staff page to
 * source real schools + pending invites and to create/revoke staff invites
 * via identity-svc, replacing the in-memory demo store when a real access
 * token is present.
 * ---------------------------------------------------------------------- */

export type DistrictSchool = { id: string; name: string };

export type DistrictAdminInvite = {
  id: string;
  email: string;
  name: string;
  role: string; // wire format (uppercase)
  schoolId: string | null;
  schoolName: string | null;
  createdAt: string;
};

async function districtGet<T>(
  accessToken: string,
  path: string,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  let res: Response;
  try {
    res = await fetch(`${serverEnv.IDENTITY_SVC_URL}${path}`, {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, status: 502, error: `identity-svc unreachable: ${(err as Error).message}` };
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: typeof json.error === "string" ? json.error : "Request failed",
    };
  }
  return { ok: true, data: json as T };
}

/** GET /api/district/schools — schools in the caller's district. */
export async function identityListDistrictSchools(
  accessToken: string,
): Promise<{ ok: true; schools: DistrictSchool[] } | { ok: false; status: number; error: string }> {
  const res = await districtGet<{ schools: Array<{ id: string; name: string }> }>(
    accessToken,
    "/api/district/schools",
  );
  if (!res.ok) return res;
  const schools = (res.data.schools ?? []).map((s) => ({ id: s.id, name: s.name }));
  return { ok: true, schools };
}

/** GET /api/district/admins — district/school admins + all pending staff invites. */
export async function identityListDistrictAdmins(
  accessToken: string,
): Promise<
  { ok: true; pendingInvites: DistrictAdminInvite[] } | { ok: false; status: number; error: string }
> {
  const res = await districtGet<{ pendingInvites: DistrictAdminInvite[] }>(
    accessToken,
    "/api/district/admins",
  );
  if (!res.ok) return res;
  return { ok: true, pendingInvites: res.data.pendingInvites ?? [] };
}

export type IdentityCreateAdminInviteResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/** POST /api/district/admins — invite a DISTRICT_ADMIN or SCHOOL_ADMIN. */
export async function identityCreateAdminInvite(
  accessToken: string,
  input: {
    email: string;
    name: string;
    role: "DISTRICT_ADMIN" | "SCHOOL_ADMIN";
    schoolId?: string;
  },
): Promise<IdentityCreateAdminInviteResult> {
  let res: Response;
  try {
    res = await fetch(`${serverEnv.IDENTITY_SVC_URL}/api/district/admins`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(input),
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, status: 502, error: `identity-svc unreachable: ${(err as Error).message}` };
  }
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const error =
      json.code === "STEP_UP_REQUIRED"
        ? "Additional verification is required to invite admins. Re-authenticate and try again."
        : typeof json.error === "string"
          ? json.error
          : "Could not send the invitation.";
    return { ok: false, status: res.status, error };
  }
  return { ok: true };
}

/** DELETE /api/district/admins/invites/:id — revoke any pending staff invite. */
export async function identityRevokeAdminInvite(
  accessToken: string,
  inviteId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  let res: Response;
  try {
    res = await fetch(
      `${serverEnv.IDENTITY_SVC_URL}/api/district/admins/invites/${encodeURIComponent(inviteId)}`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );
  } catch (err) {
    return { ok: false, status: 502, error: `identity-svc unreachable: ${(err as Error).message}` };
  }
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      ok: false,
      status: res.status,
      error: typeof json.error === "string" ? json.error : "Could not revoke the invitation.",
    };
  }
  return { ok: true };
}

export type PlatformStaffRecord = {
  id: string;
  tenantId: string | null;
  email: string;
  name: string;
  role: string;
  active: boolean;
  mustChangePassword?: boolean;
  deactivatedAt?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
};

export async function identityListPlatformStaff(
  accessToken: string,
): Promise<{ ok: true; staff: PlatformStaffRecord[] } | { ok: false; status: number; error: string }> {
  let res: Response;
  try {
    res = await fetch(`${serverEnv.IDENTITY_SVC_URL}/api/admin/staff`, {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, status: 502, error: `identity-svc unreachable: ${(err as Error).message}` };
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: typeof json.error === "string" ? json.error : "Could not load platform staff.",
    };
  }
  return { ok: true, staff: (json.staff ?? []) as PlatformStaffRecord[] };
}

export async function identityCreatePlatformStaff(
  accessToken: string,
  input: { email: string; name: string; role: string },
): Promise<
  | { ok: true; user: PlatformStaffRecord; tempPassword?: string }
  | { ok: false; status: number; error: string }
> {
  let res: Response;
  try {
    res = await fetch(`${serverEnv.IDENTITY_SVC_URL}/api/admin/staff`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, status: 502, error: `identity-svc unreachable: ${(err as Error).message}` };
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: typeof json.error === "string" ? json.error : "Could not create the staff account.",
    };
  }
  return {
    ok: true,
    user: json.user as PlatformStaffRecord,
    tempPassword: typeof json.tempPassword === "string" ? json.tempPassword : undefined,
  };
}

export async function identityCreateDistrictSchool(
  accessToken: string,
  input: { name: string },
): Promise<{ ok: true; school: { id: string; name: string } } | { ok: false; status: number; error: string }> {
  let res: Response;
  try {
    res = await fetch(`${serverEnv.IDENTITY_SVC_URL}/api/district/schools`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, status: 502, error: `identity-svc unreachable: ${(err as Error).message}` };
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: typeof json.error === "string" ? json.error : "Could not create the school.",
    };
  }
  return { ok: true, school: json.school as { id: string; name: string } };
}

export type SchoolLearnerRecord = {
  id: string;
  userId?: string;
  parentId?: string;
  name: string;
  gradeLevel?: string | null;
  functioningLevel?: string | null;
  schoolId?: string | null;
  createdAt?: string;
};

export async function identityListSchoolLearners(
  accessToken: string,
  schoolId?: string,
): Promise<
  | { ok: true; learners: SchoolLearnerRecord[]; school?: { id: string; name: string } }
  | { ok: false; status: number; error: string }
> {
  const url = new URL(`${serverEnv.IDENTITY_SVC_URL}/api/school/learners`);
  if (schoolId) url.searchParams.set("schoolId", schoolId);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, status: 502, error: `identity-svc unreachable: ${(err as Error).message}` };
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: typeof json.error === "string" ? json.error : "Could not load school learners.",
    };
  }
  return {
    ok: true,
    learners: (json.learners ?? []) as SchoolLearnerRecord[],
    school: json.school as { id: string; name: string } | undefined,
  };
}

export async function identityCreateSchoolLearner(
  accessToken: string,
  input: {
    name: string;
    gradeLevel?: string;
    functioningLevel?: string;
    schoolId?: string;
  },
): Promise<
  | { ok: true; learner: SchoolLearnerRecord }
  | { ok: false; status: number; error: string }
> {
  let res: Response;
  try {
    res = await fetch(`${serverEnv.IDENTITY_SVC_URL}/api/school/learners`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, status: 502, error: `identity-svc unreachable: ${(err as Error).message}` };
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: typeof json.error === "string" ? json.error : "Could not create the learner.",
    };
  }
  return {
    ok: true,
    learner: json.learner as SchoolLearnerRecord,
  };
}

/** PATCH /api/users/me/timezone — Sprint A8 viewer-timezone persistence. */
export async function identityUpdateTimezone(
  accessToken: string,
  input: { timezone: string; source: "auto" | "user" },
): Promise<{ ok: boolean; status: number; timezone?: string; tzSource?: string; error?: string }> {
  let res: Response;
  try {
    res = await fetch(`${serverEnv.IDENTITY_SVC_URL}/api/users/me/timezone`, {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(input),
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, status: 502, error: `identity-svc unreachable: ${(err as Error).message}` };
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return { ok: false, status: res.status, error: String(json.error ?? "timezone update failed") };
  }
  return {
    ok: true,
    status: res.status,
    timezone: typeof json.timezone === "string" ? json.timezone : undefined,
    tzSource: typeof json.tzSource === "string" ? json.tzSource : undefined,
  };
}
