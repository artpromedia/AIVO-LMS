import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as jose from "jose";
import {
  pkceChallenge,
  newLoginParams,
  buildAuthorizeUrl,
  discoveryUrlFor,
  extractOidcEmail,
  extractOidcName,
  mapOidcRole,
  validateIdToken,
  type OidcRpConfig,
  type OidcDiscovery,
} from "../src/services/oidc-rp.js";

const CFG: OidcRpConfig = {
  enabled: true,
  issuer: "https://idp.example.com",
  clientId: "aivo-client",
  scopes: ["email", "profile"],
  roleClaim: "groups",
  roleMap: { "okta-district-admins": "DISTRICT_ADMIN", "okta-teachers": "TEACHER" },
  defaultRole: "TEACHER",
};

test("pkceChallenge is the base64url SHA-256 of the verifier", () => {
  const verifier = "abc123";
  const expected = createHash("sha256").update(verifier).digest("base64url");
  assert.equal(pkceChallenge(verifier), expected);
});

test("discoveryUrlFor derives the well-known path or honours an explicit url", () => {
  assert.equal(
    discoveryUrlFor({ issuer: "https://idp.example.com/" }),
    "https://idp.example.com/.well-known/openid-configuration",
  );
  assert.equal(
    discoveryUrlFor({ issuer: "https://idp.example.com", discoveryUrl: "https://x/disco" }),
    "https://x/disco",
  );
});

test("newLoginParams produces distinct high-entropy values", () => {
  const a = newLoginParams();
  const b = newLoginParams();
  assert.notEqual(a.state, b.state);
  assert.notEqual(a.nonce, b.nonce);
  assert.notEqual(a.codeVerifier, b.codeVerifier);
  assert.ok(a.codeVerifier.length >= 40);
});

test("buildAuthorizeUrl always includes openid scope, PKCE S256, state and nonce", () => {
  const params = { state: "st", nonce: "no", codeVerifier: "ver" };
  const url = new URL(
    buildAuthorizeUrl("https://idp.example.com/authorize", CFG, "https://aivo/cb", params),
  );
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), "aivo-client");
  assert.equal(url.searchParams.get("redirect_uri"), "https://aivo/cb");
  assert.equal(url.searchParams.get("state"), "st");
  assert.equal(url.searchParams.get("nonce"), "no");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("code_challenge"), pkceChallenge("ver"));
  const scopes = (url.searchParams.get("scope") || "").split(" ");
  assert.ok(scopes.includes("openid"));
  assert.ok(scopes.includes("email"));
});

test("claim extraction is case-folded for email and falls back for name", () => {
  assert.equal(extractOidcEmail({ email: "Ada@Example.com" } as any, CFG), "ada@example.com");
  assert.equal(extractOidcEmail({ email: "not-an-email" } as any, CFG), null);
  assert.equal(extractOidcName({ name: "Ada Lovelace" } as any, CFG), "Ada Lovelace");
  assert.equal(extractOidcName({} as any, CFG), null);
});

test("mapOidcRole resolves the first matching group, else the default", () => {
  assert.equal(mapOidcRole({ groups: ["other", "okta-teachers"] } as any, CFG), "TEACHER");
  assert.equal(mapOidcRole({ groups: "okta-district-admins" } as any, CFG), "DISTRICT_ADMIN");
  assert.equal(mapOidcRole({ groups: ["unknown"] } as any, CFG), "TEACHER");
  assert.equal(mapOidcRole({} as any, CFG), "TEACHER");
});

test("validateIdToken accepts a well-formed token and enforces issuer/aud/nonce", async () => {
  const { publicKey, privateKey } = await jose.generateKeyPair("RS256");
  const discovery: OidcDiscovery = {
    issuer: CFG.issuer,
    authorization_endpoint: "https://idp.example.com/authorize",
    token_endpoint: "https://idp.example.com/token",
    jwks_uri: "https://idp.example.com/jwks",
  };
  const getKey = (async () => publicKey) as unknown as jose.JWTVerifyGetKey;

  const goodToken = await new jose.SignJWT({ nonce: "abc", email: "ada@example.com" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(CFG.issuer)
    .setAudience(CFG.clientId)
    .setExpirationTime("5m")
    .sign(privateKey);

  const claims = await validateIdToken(goodToken, discovery, CFG, "abc", getKey);
  assert.equal(claims.email, "ada@example.com");

  // Nonce mismatch is rejected.
  await assert.rejects(
    validateIdToken(goodToken, discovery, CFG, "WRONG", getKey),
    /nonce mismatch/i,
  );

  // Wrong audience is rejected by jose.
  const wrongAud = await new jose.SignJWT({ nonce: "abc" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(CFG.issuer)
    .setAudience("someone-else")
    .setExpirationTime("5m")
    .sign(privateKey);
  await assert.rejects(validateIdToken(wrongAud, discovery, CFG, "abc", getKey));
});
