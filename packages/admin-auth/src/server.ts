import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import * as jose from "jose";
import * as fs from "node:fs";
import * as path from "node:path";
import { IDENTITY_ACCESS_TOKEN_COOKIE, IDENTITY_SESSION_COOKIE } from "./identity-client.js";
import { ADMIN_ROLES, isAdminRole, PLATFORM_ROLES, sessionHasPermission } from "./permissions.js";
import { ROLE_HOME, type Role, type SessionProfile } from "./types.js";

type JwtClaims = {
  sub: string;
  /** identity-svc mints tokens with `tenantId: null` for platform staff. */
  tenantId: string | null;
  role: string;
};

let publicKey: jose.CryptoKey | Uint8Array | null = null;

async function loadPublicKey(): Promise<jose.CryptoKey | Uint8Array> {
  if (publicKey) return publicKey;

  const publicKeyPem = process.env.JWT_PUBLIC_KEY;
  if (publicKeyPem) {
    publicKey = await jose.importSPKI(publicKeyPem, "RS256");
    return publicKey;
  }

  const keyDir =
    process.env.JWT_KEY_DIR || path.resolve(process.cwd(), "..", "..", ".local", "jwt-keys");
  const publicKeyPath = path.join(keyDir, "public.pem");
  if (!fs.existsSync(publicKeyPath)) {
    throw new Error("JWT_PUBLIC_KEY or JWT_KEY_DIR public.pem is required for admin session verification");
  }

  publicKey = await jose.importSPKI(fs.readFileSync(publicKeyPath, "utf8"), "RS256");
  return publicKey;
}

async function verifyIdentityJwt(token: string): Promise<JwtClaims> {
  const key = await loadPublicKey();
  const { payload } = await jose.jwtVerify(token, key, { issuer: "aivo:identity-svc" });
  return payload as unknown as JwtClaims;
}

export function parseSessionCookie(value: string | undefined): SessionProfile | null {
  if (!value) return null;
  try {
    const profile = JSON.parse(decodeURIComponent(value)) as Partial<
      Omit<SessionProfile, "tenantId"> & { tenantId: string | null }
    >;
    if (
      typeof profile.userId !== "string" ||
      (typeof profile.tenantId !== "string" && profile.tenantId !== null) ||
      typeof profile.role !== "string" ||
      typeof profile.email !== "string" ||
      typeof profile.displayName !== "string"
    ) {
      return null;
    }
    return {
      userId: profile.userId,
      tenantId: profile.tenantId ?? "",
      role: profile.role as Role,
      email: profile.email,
      displayName: profile.displayName,
      permissions: Array.isArray(profile.permissions) ? profile.permissions.map(String) : [],
      learnerId: typeof profile.learnerId === "string" ? profile.learnerId : undefined,
      roles: Array.isArray(profile.roles) ? (profile.roles.filter((role) => typeof role === "string") as Role[]) : undefined,
      capabilities: Array.isArray(profile.capabilities) ? profile.capabilities.map(String) : undefined,
    };
  } catch {
    return null;
  }
}

type ReadableCookieJar = {
  get: (name: string) => { value: string } | undefined;
};

export async function readAdminSessionFromCookies(
  jar?: ReadableCookieJar,
): Promise<SessionProfile | null> {
  const cookieJar = jar ?? (await cookies());
  const accessToken = cookieJar.get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
  const session = parseSessionCookie(cookieJar.get(IDENTITY_SESSION_COOKIE)?.value);
  if (!accessToken || !session || !isAdminRole(session.role)) return null;

  let claims: JwtClaims;
  try {
    claims = await verifyIdentityJwt(accessToken);
  } catch {
    return null;
  }

  if (claims.sub !== session.userId || (claims.tenantId ?? "") !== session.tenantId) return null;
  const claimRole = String(claims.role ?? "").toLowerCase() as Role;
  if (claimRole !== session.role) return null;
  return session;
}

export async function requireAdminPage(permission?: string): Promise<SessionProfile> {
  const session = await readAdminSessionFromCookies();
  if (!session) redirect("/login");
  if (permission && !sessionHasPermission(session, permission)) {
    redirect(ROLE_HOME[session.role]);
  }
  return session;
}

export async function requirePageRole(roles: Role[]): Promise<SessionProfile> {
  const session = await requireAdminPage();
  if (!roles.includes(session.role)) redirect(ROLE_HOME[session.role]);
  return session;
}

export async function requirePagePermission(
  permission: string,
  roles?: Role[],
): Promise<SessionProfile> {
  const session = await requireAdminPage(permission);
  if (roles && !roles.includes(session.role)) redirect(ROLE_HOME[session.role]);
  return session;
}

export async function requirePlatformPage(permission: string): Promise<SessionProfile> {
  return requirePagePermission(permission, [...PLATFORM_ROLES]);
}

export async function requireAnonymous(
  redirectAuthenticatedRoles: readonly Role[] = [...ADMIN_ROLES],
): Promise<SessionProfile | null> {
  const session = await readAdminSessionFromCookies();
  if (!session) return null;
  if (redirectAuthenticatedRoles.includes(session.role)) redirect(ROLE_HOME[session.role]);
  return session;
}
