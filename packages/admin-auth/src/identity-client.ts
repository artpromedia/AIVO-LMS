import { capabilitiesForRole } from "./permissions.js";
import type { Role, SessionProfile } from "./types.js";

export const IDENTITY_ACCESS_TOKEN_COOKIE = "aivo_access_token";
export const IDENTITY_REFRESH_TOKEN_COOKIE = "aivo_refresh_token";
export const IDENTITY_SESSION_COOKIE = "aivo_session";

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

export type IdentityUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  /** Platform-scope staff (PLATFORM_ADMIN, SUPPORT, …) have no tenant. */
  tenantId: string | null;
};

export type IdentityLoginSuccess = {
  kind: "ok";
  user: IdentityUser;
  accessToken: string;
  mustChangePassword?: boolean;
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

function identitySvcUrl(): string {
  return process.env.IDENTITY_SVC_URL || "http://localhost:3001";
}

function readSetCookies(headers: Headers): string[] {
  const anyHeaders = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") return anyHeaders.getSetCookie();
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
    if (name === "refreshToken") return decodeURIComponent(first.slice(eq + 1));
  }
  return null;
}

export function extractRefreshToken(setCookies: string[]): string | null {
  return parseRefreshToken(setCookies);
}

export function mapWireRoleToRole(wire: string | undefined | null): Role | null {
  if (!wire) return null;
  return WIRE_TO_ROLE[wire.toUpperCase()] ?? null;
}

export async function identityAdminLogin(email: string, password: string): Promise<IdentityLoginResult> {
  let res: Response;
  try {
    res = await fetch(`${identitySvcUrl()}/api/auth/admin-login`, {
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

export async function identityVerifyMfa(
  mfaToken: string,
  code: string,
): Promise<IdentityLoginSuccess | IdentityLoginError> {
  let res: Response;
  try {
    res = await fetch(`${identitySvcUrl()}/api/auth/verify-mfa`, {
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

export async function identityResendMfa(
  mfaToken: string,
): Promise<{ ok: true; resendsRemaining: number } | { ok: false; status: number; error: string }> {
  let res: Response;
  try {
    res = await fetch(`${identitySvcUrl()}/api/auth/mfa/resend`, {
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

export function toSessionProfile(user: IdentityUser): SessionProfile | null {
  const role = mapWireRoleToRole(user.role);
  if (!role) return null;
  const permissions = capabilitiesForRole(role);
  return {
    userId: user.id,
    // Tenantless platform staff are stored as "" so the session cookie and
    // JWT cross-checks treat "no tenant" consistently (see types.ts).
    tenantId: user.tenantId ?? "",
    role,
    email: user.email,
    displayName: user.name ?? user.email,
    permissions,
    capabilities: permissions,
  };
}
