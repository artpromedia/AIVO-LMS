import { createSign, generateKeyPairSync } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

// Import the package source (not the built dist) so the suite exercises the
// same files developers edit, without requiring a prior tsc build.
import {
  IDENTITY_ACCESS_TOKEN_COOKIE,
  IDENTITY_SESSION_COOKIE,
  parseSessionCookie,
  readAdminSessionFromCookies,
  toSessionProfile,
} from "../../packages/admin-auth/src/index.js";

const jar = new Map<string, string>();
const cookieJar = {
  get: (name: string) => {
    const value = jar.get(name);
    return value === undefined ? undefined : { value };
  },
};

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

function signIdentityJwt(claims: Record<string, unknown>): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: "aivo:identity-svc", iat: now, exp: now + 900, ...claims }),
  ).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(privateKey).toString("base64url")}`;
}

function encodeSessionCookie(profile: Record<string, unknown>): string {
  return encodeURIComponent(JSON.stringify(profile));
}

const PLATFORM_USER_ID = "11111111-1111-4111-8111-111111111111";

const platformProfile = {
  userId: PLATFORM_USER_ID,
  tenantId: "",
  role: "platform_admin",
  email: "admin@aivolearning.com",
  displayName: "Platform Admin",
  permissions: [],
};

beforeAll(() => {
  process.env.JWT_PUBLIC_KEY = publicKey.export({ type: "spki", format: "pem" }).toString();
});

beforeEach(() => {
  jar.clear();
});

describe("toSessionProfile", () => {
  it("maps a tenantless platform admin (tenant_id NULL) to a session with empty tenantId", () => {
    const profile = toSessionProfile({
      id: PLATFORM_USER_ID,
      email: "admin@aivolearning.com",
      name: "Platform Admin",
      role: "PLATFORM_ADMIN",
      tenantId: null,
    });
    expect(profile).not.toBeNull();
    expect(profile?.role).toBe("platform_admin");
    expect(profile?.tenantId).toBe("");
  });

  it("keeps the real tenant id for tenant-scoped admins", () => {
    const profile = toSessionProfile({
      id: PLATFORM_USER_ID,
      email: "district@aivolearning.com",
      name: "District Admin",
      role: "DISTRICT_ADMIN",
      tenantId: "tenant-1",
    });
    expect(profile?.tenantId).toBe("tenant-1");
  });
});

describe("parseSessionCookie", () => {
  it("round-trips a tenantless platform admin profile", () => {
    const parsed = parseSessionCookie(encodeSessionCookie(platformProfile));
    expect(parsed).not.toBeNull();
    expect(parsed?.role).toBe("platform_admin");
    expect(parsed?.tenantId).toBe("");
  });

  it("accepts legacy cookies written with tenantId null", () => {
    const parsed = parseSessionCookie(encodeSessionCookie({ ...platformProfile, tenantId: null }));
    expect(parsed).not.toBeNull();
    expect(parsed?.tenantId).toBe("");
  });

  it("rejects cookies missing the tenantId field entirely", () => {
    const { tenantId: _tenantId, ...withoutTenant } = platformProfile;
    expect(parseSessionCookie(encodeSessionCookie(withoutTenant))).toBeNull();
  });
});

describe("readAdminSessionFromCookies", () => {
  it("authenticates a platform admin whose JWT carries tenantId null", async () => {
    jar.set(
      IDENTITY_ACCESS_TOKEN_COOKIE,
      signIdentityJwt({ sub: PLATFORM_USER_ID, tenantId: null, role: "PLATFORM_ADMIN" }),
    );
    jar.set(IDENTITY_SESSION_COOKIE, encodeSessionCookie(platformProfile));

    const session = await readAdminSessionFromCookies(cookieJar);
    expect(session).not.toBeNull();
    expect(session?.role).toBe("platform_admin");
    expect(session?.tenantId).toBe("");
  });

  it("authenticates a platform admin with a legacy null-tenant session cookie", async () => {
    jar.set(
      IDENTITY_ACCESS_TOKEN_COOKIE,
      signIdentityJwt({ sub: PLATFORM_USER_ID, tenantId: null, role: "PLATFORM_ADMIN" }),
    );
    jar.set(IDENTITY_SESSION_COOKIE, encodeSessionCookie({ ...platformProfile, tenantId: null }));

    const session = await readAdminSessionFromCookies(cookieJar);
    expect(session).not.toBeNull();
    expect(session?.tenantId).toBe("");
  });

  it("authenticates tenant-scoped admins with matching tenant ids", async () => {
    const profile = { ...platformProfile, role: "district_admin", tenantId: "tenant-1" };
    jar.set(
      IDENTITY_ACCESS_TOKEN_COOKIE,
      signIdentityJwt({ sub: PLATFORM_USER_ID, tenantId: "tenant-1", role: "DISTRICT_ADMIN" }),
    );
    jar.set(IDENTITY_SESSION_COOKIE, encodeSessionCookie(profile));

    const session = await readAdminSessionFromCookies(cookieJar);
    expect(session).not.toBeNull();
    expect(session?.tenantId).toBe("tenant-1");
  });

  it("still rejects sessions whose tenant does not match the JWT claim", async () => {
    const profile = { ...platformProfile, role: "district_admin", tenantId: "tenant-2" };
    jar.set(
      IDENTITY_ACCESS_TOKEN_COOKIE,
      signIdentityJwt({ sub: PLATFORM_USER_ID, tenantId: "tenant-1", role: "DISTRICT_ADMIN" }),
    );
    jar.set(IDENTITY_SESSION_COOKIE, encodeSessionCookie(profile));

    expect(await readAdminSessionFromCookies(cookieJar)).toBeNull();
  });
});
